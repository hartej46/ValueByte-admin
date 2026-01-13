import { NextResponse } from "next/server";
import prismadb from "@/lib/prismadb";
import { verifyToken } from "@clerk/backend";

// Use CUSTOMER_CLERK_* keys for verifying tokens from store customers
// These should be the same keys used in the ecommerce-store app
function resolveCustomerClerkIssuer(): string | undefined {
  if (process.env.CUSTOMER_CLERK_ISSUER) return process.env.CUSTOMER_CLERK_ISSUER;

  // Use customer-specific publishable key, or fall back to admin's
  const pk = process.env.CUSTOMER_CLERK_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  if (!pk) return undefined;

  const parts = pk.split('_');
  if (parts.length < 3) return undefined;

  const b64 = parts.slice(2).join('_');
  try {
    const decoded = Buffer.from(b64, 'base64').toString('utf-8');
    const host = decoded.replace(/\$/g, '');
    if (!host) return undefined;
    return `https://${host}`;
  } catch {
    return undefined;
  }
}

async function getCustomerIdFromRequest(req: Request): Promise<string | undefined> {
  try {
    // Get token from Authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log('No Authorization header or invalid format');
      return undefined;
    }

    const token = authHeader.split(' ')[1];
    console.log('Token extracted from header:', token ? '✅' : '❌');

    // Use customer-specific secret key for verifying store customer tokens
    const secretKey = process.env.CUSTOMER_CLERK_SECRET_KEY || process.env.CLERK_SECRET_KEY;
    if (!secretKey) {
      console.log('No CUSTOMER_CLERK_SECRET_KEY or CLERK_SECRET_KEY found');
      return undefined;
    }

    const issuer = resolveCustomerClerkIssuer();
    console.log('Using issuer:', issuer);

    const payload = await verifyToken(token, {
      secretKey: secretKey,
      issuer: issuer ?? null
    });
    console.log('Token payload:', payload);
    return payload?.sub || undefined;
  } catch (error) {
    console.log('Token verification error:', error);
    return undefined;
  }
}

const corsHeaders = {
  'Access-Control-Allow-Origin': process.env.FRONTEND_URL || 'http://localhost:3000',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Credentials': 'true'
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: corsHeaders });
}

// Get or create customer profile
export async function GET(
  req: Request,
  { params }: { params: { storeId: string } }
) {
  try {
    const clerkId = await getCustomerIdFromRequest(req);
    if (!clerkId) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    console.log("Fetching customer for clerkId:", clerkId);

    let customer = await prismadb.customer.findUnique({
      where: { clerkId },
      include: { addresses: true }
    });

    // Create customer if doesn't exist
    if (!customer) {
      console.log("Creating new customer for clerkId:", clerkId);
      customer = await prismadb.customer.create({
        data: { clerkId },
        include: { addresses: true }
      });
    }

    return NextResponse.json(customer, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    console.log('[CUSTOMER_GET]', error);
    return new NextResponse("Internal error", { status: 500 });
  }
}

// Add new address
export async function POST(
  req: Request,
  { params }: { params: { storeId: string } }
) {
  try {
    console.log("=== CUSTOMER POST REQUEST START ===");

    const clerkId = await getCustomerIdFromRequest(req);
    console.log("Clerk ID from token:", clerkId);

    if (!clerkId) {
      console.log("ERROR: No clerkId found");
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const { fullName, mobile, houseFlat, locality, areaStreet, landmark, city, isDefault } = await req.json();
    console.log("Address data received:", { fullName, mobile, houseFlat, locality, areaStreet, landmark, city, isDefault });

    // Get or create customer
    let customer = await prismadb.customer.findUnique({
      where: { clerkId }
    });

    if (!customer) {
      console.log("Creating new customer for clerkId:", clerkId);
      customer = await prismadb.customer.create({
        data: { clerkId }
      });
      console.log("Customer created:", customer);
    }

    // If setting as default, unset other defaults
    if (isDefault) {
      console.log("Unsetting other default addresses");
      await prismadb.customerAddress.updateMany({
        where: { customerId: customer.id },
        data: { isDefault: false }
      });
    }

    console.log("Creating new address...");
    const address = await prismadb.customerAddress.create({
      data: {
        customerId: customer.id,
        fullName,
        mobile,
        houseFlat,
        locality,
        areaStreet,
        landmark,
        city,
        isDefault: isDefault || false
      }
    });

    console.log("Address created successfully:", address);
    return NextResponse.json(address, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    console.log('[ADDRESS_POST ERROR]', error);
    return new NextResponse("Internal error", { status: 500 });
  }
}
