import { NextResponse } from 'next/server';

import { verifyToken } from '@clerk/backend';

import { razorpay } from '@/lib/razorpay';
import prismadb from '@/lib/prismadb';

const corsHeaders = {
  "Access-Control-Allow-Origin": process.env.FRONTEND_URL || "http://localhost:3000",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Credentials": "true"
};

function resolveCustomerClerkIssuer(): string | undefined {
  if (process.env.CUSTOMER_CLERK_ISSUER) return process.env.CUSTOMER_CLERK_ISSUER;

  const pk = process.env.CUSTOMER_CLERK_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  if (!pk) return undefined;

  const parts = pk.split("_");
  if (parts.length < 3) return undefined;

  const b64 = parts.slice(2).join("_");
  try {
    const decoded = Buffer.from(b64, "base64").toString("utf-8");
    const host = decoded.replace(/\$/g, "");
    if (!host) return undefined;
    return `https://${host}`;
  } catch {
    return undefined;
  }
}

async function getCustomerIdFromRequest(req: Request): Promise<string | undefined> {
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.toLowerCase().startsWith("bearer ")) return undefined;

  const secretKey = process.env.CUSTOMER_CLERK_SECRET_KEY || process.env.CLERK_SECRET_KEY;
  const issuer = resolveCustomerClerkIssuer();
  if (!secretKey) return undefined;

  const token = authHeader.slice(7);
  try {
    const payload = await verifyToken(token, {
      secretKey,
      issuer: issuer ?? null,
    });
    return payload?.sub || undefined;
  } catch {
    return undefined;
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: corsHeaders });
}

export async function POST(
  req: Request,
  { params }: { params: { storeId: string } }
) {

  // Check if storeId exists
  if (!params.storeId) {
    return new NextResponse("Store ID is required", { status: 400 });
  }

  const { productIds, address, addressId } = await req.json();

  const customerId = await getCustomerIdFromRequest(req);

  if (!productIds || productIds.length === 0) {
    return new NextResponse("Product IDs are required", { status: 400 });
  }

  if (!address && !addressId) {
    return new NextResponse("Address is required", { status: 400 });
  }

  let customerAddressId = addressId;

  // If address object is provided (new address), create it first
  if (address && !addressId) {
    // Get or create customer
    let customer = await prismadb.customer.findUnique({
      where: { clerkId: customerId || "" }
    });

    if (!customer && customerId) {
      customer = await prismadb.customer.create({
        data: { clerkId: customerId }
      });
    }

    // If setting as default, unset other defaults
    if (address.isDefault && customer) {
      await prismadb.customerAddress.updateMany({
        where: { customerId: customer.id },
        data: { isDefault: false }
      });
    }

    if (!customer) {
      return new NextResponse("Customer creation failed", { status: 500, headers: corsHeaders });
    }

    const newAddress = await prismadb.customerAddress.create({
      data: {
        customerId: customer.id,
        fullName: address.fullName,
        mobile: address.mobile,
        houseFlat: address.houseFlat,
        locality: address.locality,
        areaStreet: address.areaStreet,
        landmark: address.landmark,
        city: address.city,
        isDefault: address.isDefault || false
      }
    });

    customerAddressId = newAddress.id;
  }

  // Fetch products by IDs in checkout route
  const products = await prismadb.product.findMany({
    where: {
      id: {
        in: productIds
      }
    }
  });

  const totalAmount = products.reduce((total, product) => {
    return total + product.price.toNumber();
  }, 0);

  // Create the order in the database
  const order = await prismadb.order.create({
    data: ({
      storeId: params.storeId,
      ...(customerId ? { customerId } : {}),
      ...(customerAddressId ? { customerAddressId } : {}),
      isPaid: false,
      // Keep address fields for backward compatibility and new addresses
      fullName: address?.fullName || "",
      email: address?.email || "",
      mobile: address?.mobile || "",
      houseFlat: address?.houseFlat || "",
      locality: address?.locality || "",
      areaStreet: address?.areaStreet || "",
      landmark: address?.landmark || null,
      city: address?.city || "",
      orderItems: {
        create: productIds.map((productId: string) => ({
          product: {
            connect: {
              id: productId
            }
          }
        }))
      }
    } as any)
  });

  // Create Razorpay Order
  const options = {
    amount: Math.round(totalAmount * 100), // amount in the smallest currency unit
    currency: "INR", // Changed to INR for Razorpay (adjust if needed)
    receipt: order.id,
    notes: {
      orderId: order.id,
      storeId: params.storeId
    }
  };

  if (!razorpay) {
    return new NextResponse("Razorpay is not configured", { status: 500, headers: corsHeaders });
  }

  const razorpayOrder = await razorpay.orders.create(options);

  return NextResponse.json({
    orderId: razorpayOrder.id,
    amount: razorpayOrder.amount,
    currency: razorpayOrder.currency,
    key_id: process.env.RAZORPAY_KEY_ID,
    receipt: order.id
  }, {
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json'
    }
  });
};