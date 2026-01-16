import { NextResponse } from "next/server";
import prismadb from "@/lib/prismadb";
import { verifyToken } from "@clerk/backend";
import { getCorsHeaders } from "@/lib/cors";

// Use CUSTOMER_CLERK_* keys for verifying tokens from store customers
function resolveCustomerClerkIssuer(): string | undefined {
  if (process.env.CUSTOMER_CLERK_ISSUER) return process.env.CUSTOMER_CLERK_ISSUER;

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
    const authHeader = req.headers.get('authorization') || req.headers.get('Authorization');
    if (!authHeader?.toLowerCase().startsWith('bearer ')) {
      console.log('[ADDRESS_AUTH] No Authorization header found in addressId route');
      return undefined;
    }

    const secretKey = process.env.CUSTOMER_CLERK_SECRET_KEY || process.env.CLERK_SECRET_KEY;
    if (!secretKey) {
      console.error('[ADDRESS_AUTH] Missing Clerk Secret Key');
      return undefined;
    }

    const token = authHeader.slice(7);
    const issuer = resolveCustomerClerkIssuer();
    const payload = await verifyToken(token, {
      secretKey: secretKey!,
      issuer: issuer || null,
    });

    console.log('[ADDRESS_AUTH] Token verified for sub:', payload?.sub);
    return payload?.sub || undefined;
  } catch (error: any) {
    console.error('[ADDRESS_AUTH] verifyToken failed:', error.message);
    return undefined;
  }
}



export async function OPTIONS(req: Request) {
  return new NextResponse(null, {
    status: 204,
    headers: getCorsHeaders(req.headers.get('origin'))
  });
}

// Delete address
export async function DELETE(
  req: Request,
  { params }: { params: { storeId: string; addressId: string } }
) {
  const origin = req.headers.get('origin');
  try {
    const clerkId = await getCustomerIdFromRequest(req);
    if (!clerkId) {
      return new NextResponse("Unauthorized", {
        status: 401,
        headers: getCorsHeaders(origin)
      });
    }

    // Get customer and verify address ownership
    const customer = await prismadb.customer.findUnique({
      where: { clerkId }
    });

    if (!customer) {
      return new NextResponse("Customer not found", {
        status: 404,
        headers: getCorsHeaders(origin)
      });
    }

    // Verify address belongs to this customer
    const address = await prismadb.customerAddress.findFirst({
      where: {
        id: params.addressId,
        customerId: customer.id
      }
    });

    if (!address) {
      return new NextResponse("Address not found", {
        status: 404,
        headers: getCorsHeaders(origin)
      });
    }

    // Delete the address
    await prismadb.customerAddress.delete({
      where: { id: params.addressId }
    });

    return NextResponse.json({ success: true }, { headers: getCorsHeaders(origin) });
  } catch (error) {
    console.log('[ADDRESS_DELETE]', error);
    return new NextResponse("Internal error", {
      status: 500,
      headers: getCorsHeaders(origin)
    });
  }
}

// Set address as default
export async function PUT(
  req: Request,
  { params }: { params: { storeId: string; addressId: string } }
) {
  const origin = req.headers.get('origin');
  try {
    const clerkId = await getCustomerIdFromRequest(req);
    if (!clerkId) {
      return new NextResponse("Unauthorized", {
        status: 401,
        headers: getCorsHeaders(origin)
      });
    }

    // Get customer and verify address ownership
    const customer = await prismadb.customer.findUnique({
      where: { clerkId }
    });

    if (!customer) {
      return new NextResponse("Customer not found", {
        status: 404,
        headers: getCorsHeaders(origin)
      });
    }

    // Verify address belongs to this customer
    const address = await prismadb.customerAddress.findFirst({
      where: {
        id: params.addressId,
        customerId: customer.id
      }
    });

    if (!address) {
      return new NextResponse("Address not found", {
        status: 404,
        headers: getCorsHeaders(origin)
      });
    }

    // Unset all default addresses for this customer
    await prismadb.customerAddress.updateMany({
      where: { customerId: customer.id },
      data: { isDefault: false }
    });

    // Set this address as default
    const updatedAddress = await prismadb.customerAddress.update({
      where: { id: params.addressId },
      data: { isDefault: true }
    });

    return NextResponse.json(updatedAddress, { headers: getCorsHeaders(origin) });
  } catch (error) {
    console.log('[ADDRESS_SET_DEFAULT]', error);
    return new NextResponse("Internal error", {
      status: 500,
      headers: getCorsHeaders(origin)
    });
  }
}
