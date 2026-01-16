import { NextResponse } from 'next/server';

import { verifyToken } from '@clerk/backend';

import { razorpay } from '@/lib/razorpay';
import prismadb from '@/lib/prismadb';
import { getCorsHeaders } from '@/lib/cors';



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
  const authHeader = req.headers.get("authorization") || req.headers.get("Authorization");
  if (!authHeader?.toLowerCase().startsWith("bearer ")) {
    console.log('[CHECKOUT_AUTH] Missing or invalid authorization header');
    return undefined;
  }

  const secretKey = process.env.CUSTOMER_CLERK_SECRET_KEY || process.env.CLERK_SECRET_KEY;
  if (!secretKey) {
    console.error('[CHECKOUT_AUTH] Missing Clerk Secret Key');
    return undefined;
  }

  const token = authHeader.slice(7);
  const issuer = resolveCustomerClerkIssuer();
  try {
    const payload = await verifyToken(token, {
      secretKey,
      issuer: issuer || null,
    });
    return payload?.sub || undefined;
  } catch (error: any) {
    console.error('[CHECKOUT_AUTH] verifyToken failed:', error.message);
    return undefined;
  }
}

export async function OPTIONS(req: Request) {
  return new NextResponse(null, {
    status: 200,
    headers: getCorsHeaders(req.headers.get('origin'))
  });
}

export async function POST(
  req: Request,
  { params }: { params: { storeId: string } }
) {
  const origin = req.headers.get('origin');

  // Check if storeId exists
  if (!params.storeId) {
    return new NextResponse("Store ID is required", { status: 400 });
  }

  const { items: checkoutItems, address, addressId } = await req.json();

  const customerId = await getCustomerIdFromRequest(req);
  if (!customerId) {
    return new NextResponse("Unauthorized: Token verification failed", {
      status: 401,
      headers: getCorsHeaders(origin)
    });
  }

  if (!checkoutItems || checkoutItems.length === 0) {
    return new NextResponse("Products are required", { status: 400 });
  }

  if (!address && !addressId) {
    return new NextResponse("Address is required", { status: 400 });
  }

  let customerAddressId = addressId;
  let finalAddress = address;

  // 1. Get or create customer and handle address
  console.log('[CHECKOUT_DEBUG] Clerk Customer ID:', customerId);

  let customer = await prismadb.customer.findUnique({
    where: { clerkId: customerId || "" }
  });

  if (!customer) {
    console.log('[CHECKOUT_DEBUG] Customer not found, creating new one for:', customerId);
  } else {
    console.log('[CHECKOUT_DEBUG] Found existing customer:', customer.id);
  }

  if (!customer && customerId) {
    customer = await prismadb.customer.create({
      data: { clerkId: customerId }
    });
    console.log('[CHECKOUT_DEBUG] Created new customer:', customer.id);
  }

  // If addressId is provided, fetch that address to populate flat fields
  if (addressId) {
    const savedAddress = await prismadb.customerAddress.findUnique({
      where: { id: addressId }
    });
    if (savedAddress) {
      finalAddress = {
        fullName: savedAddress.fullName,
        mobile: savedAddress.mobile,
        houseFlat: savedAddress.houseFlat,
        locality: savedAddress.locality,
        areaStreet: savedAddress.areaStreet,
        landmark: savedAddress.landmark,
        city: savedAddress.city,
      };
    }
  }

  // If address object is provided (new address), create it first
  if (address && !addressId && customer) {
    // If setting as default, unset other defaults
    if (address.isDefault) {
      await prismadb.customerAddress.updateMany({
        where: { customerId: customer.id },
        data: { isDefault: false }
      });
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
    finalAddress = address;
  }

  const productIds = checkoutItems.map((item: any) => item.id);

  // Fetch products by IDs in checkout route
  const products = await prismadb.product.findMany({
    where: {
      id: {
        in: productIds
      }
    }
  });

  // Check stock Availability
  for (const item of checkoutItems) {
    const product = products.find((p) => p.id === item.id);
    if (!product) {
      return new NextResponse(`Product ${item.id} not found`, { status: 404 });
    }
    if (product.stock < item.quantity) {
      return new NextResponse(`Not enough stock for ${product.name}. Available: ${product.stock}`, { status: 400 });
    }
  }

  const totalAmount = checkoutItems.reduce((total: number, item: any) => {
    const product = products.find((p) => p.id === item.id);
    return total + (product ? product.price.toNumber() * item.quantity : 0);
  }, 0);

  // Create the order in the database
  const order = await prismadb.order.create({
    data: ({
      storeId: params.storeId,
      customerId: customer?.id || null, // Use database UUID not clerkId
      customerAddressId: customerAddressId || null,
      isPaid: false,
      // Keep address fields for backward compatibility and new addresses
      fullName: finalAddress?.fullName || "",
      email: finalAddress?.email || "",
      mobile: finalAddress?.mobile || "",
      houseFlat: finalAddress?.houseFlat || "",
      locality: finalAddress?.locality || "",
      areaStreet: finalAddress?.areaStreet || "",
      landmark: finalAddress?.landmark || null,
      city: finalAddress?.city || "",
      orderItems: {
        create: checkoutItems.map((item: any) => ({
          product: {
            connect: {
              id: item.id
            }
          },
          quantity: item.quantity
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
    return new NextResponse("Razorpay is not configured", {
      status: 500,
      headers: getCorsHeaders(origin)
    });
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
      ...getCorsHeaders(origin),
      'Content-Type': 'application/json'
    }
  });
};