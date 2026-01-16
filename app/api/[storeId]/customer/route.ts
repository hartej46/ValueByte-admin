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
    const authHeader = req.headers.get('Authorization') || req.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log('[AUTH] No Authorization header or invalid format');
      return undefined;
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
      console.log('[AUTH] No token found in Bearer header');
      return undefined;
    }

    // Use customer-specific secret key for verifying store customer tokens
    const secretKey = process.env.CUSTOMER_CLERK_SECRET_KEY || process.env.CLERK_SECRET_KEY;

    if (!secretKey) {
      console.error('[AUTH] Missing Clerk Secret Key');
      return undefined;
    }

    const issuer = resolveCustomerClerkIssuer();
    console.log('[AUTH] Token Verification Attempt:', {
      hasIssuer: !!issuer,
      issuer,
      usingCustomerKey: !!process.env.CUSTOMER_CLERK_SECRET_KEY
    });

    // Attempt verification without strict issuer check first to diagnose
    try {
      const payload = await verifyToken(token, {
        secretKey: secretKey,
        issuer: issuer || null,
      });

      if (!payload || !payload.sub) {
        console.log('[AUTH] Token verification succeeded but payload/sub is missing');
        return undefined;
      }

      console.log('[AUTH] Token verified successfully for sub:', payload.sub);
      return payload.sub;
    } catch (verifyError: any) {
      console.error('[AUTH] verifyToken failed:', verifyError.message);

      // OPTIONAL: Log more details about the token (don't log the whole token for security, just claims if possible)
      // Since we can't easily parse without verifying, we just log the failure.
      return undefined;
    }
  } catch (error: any) {
    console.error('[AUTH] getCustomerIdFromRequest fatal error:', error.message);
    return undefined;
  }
}

const getCorsHeaders = (origin: string | null) => {
  // Use the actual origin if present, otherwise fallback to '*'
  // Note: Access-Control-Allow-Origin cannot be '*' if Access-Control-Allow-Credentials is true
  const allowedOrigin = origin || "*";

  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Credentials': 'true'
  };
};

export async function OPTIONS(req: Request) {
  return new NextResponse(null, {
    status: 204,
    headers: getCorsHeaders(req.headers.get('origin'))
  });
}

// Get or create customer profile
export async function GET(
  req: Request,
  { params }: { params: { storeId: string } }
) {
  const origin = req.headers.get('origin');
  try {
    const clerkId = await getCustomerIdFromRequest(req);
    if (!clerkId) {
      return new NextResponse("Unauthorized: Token verification failed", {
        status: 401,
        headers: getCorsHeaders(origin)
      });
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

    console.log("About to return customer data:", !!customer);
    const headers = getCorsHeaders(origin);
    console.log("Response headers:", JSON.stringify(headers));

    return NextResponse.json(customer, { headers });
  } catch (error) {
    console.log('[CUSTOMER_GET]', error);
    return new NextResponse("Internal error", {
      status: 500,
      headers: getCorsHeaders(origin)
    });
  }
}

// Add new address
export async function POST(
  req: Request,
  { params }: { params: { storeId: string } }
) {
  const origin = req.headers.get('origin');
  try {
    console.log("=== CUSTOMER POST REQUEST START ===");

    const clerkId = await getCustomerIdFromRequest(req);
    console.log("Clerk ID from token:", clerkId);

    if (!clerkId) {
      console.log("ERROR: No clerkId found");
      return new NextResponse("Unauthorized: Token verification failed", {
        status: 401,
        headers: getCorsHeaders(origin)
      });
    }

    const { fullName, email, mobile, houseFlat, locality, areaStreet, landmark, city, isDefault } = await req.json();
    console.log("Address data received:", { fullName, email, mobile, houseFlat, locality, areaStreet, landmark, city, isDefault });

    // Get or create customer
    let customer = await prismadb.customer.findUnique({
      where: { clerkId },
      include: { addresses: true }
    });

    if (!customer) {
      console.log("Creating new customer for clerkId:", clerkId);
      customer = await prismadb.customer.create({
        data: {
          clerkId,
          fullName: fullName || "",
          email: email || "",
          mobile: mobile || ""
        },
        include: { addresses: true }
      });
      console.log("Customer created:", customer);
    } else {
      // Update customer info if it was empty
      console.log("Updating existing customer info if needed...");
      await prismadb.customer.update({
        where: { id: customer.id },
        data: {
          fullName: customer.fullName || fullName || "",
          email: customer.email || email || "",
          mobile: customer.mobile || mobile || ""
        }
      });
    }

    // Determine if this should be the default address
    // If it's explicitly requested OR if it's the customer's first address
    const shouldBeDefault = isDefault || customer.addresses.length === 0;

    // If setting as default, unset other defaults
    if (shouldBeDefault) {
      console.log("Setting as default, unsetting other default addresses");
      await prismadb.customerAddress.updateMany({
        where: { customerId: customer.id },
        data: { isDefault: false }
      });
    }

    console.log("Creating new address with shouldBeDefault:", shouldBeDefault);
    const address = await prismadb.customerAddress.create({
      data: {
        customerId: customer.id,
        fullName,
        mobile,
        houseFlat,
        locality,
        areaStreet,
        landmark: landmark || null,
        city,
        isDefault: shouldBeDefault
      }
    });

    console.log("Address created successfully:", address);
    console.log("About to return new address data:", !!address);
    const headers = getCorsHeaders(origin);
    console.log("Response headers:", JSON.stringify(headers));

    return NextResponse.json(address, { headers });
  } catch (error) {
    console.log('[ADDRESS_POST ERROR]', error);
    return new NextResponse("Internal error", {
      status: 500,
      headers: getCorsHeaders(origin)
    });
  }
}
