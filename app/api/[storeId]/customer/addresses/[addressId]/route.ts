import { NextResponse } from "next/server";
import prismadb from "@/lib/prismadb";
import { verifyToken } from "@clerk/backend";

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
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.toLowerCase().startsWith('bearer ')) return undefined;

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

const corsHeaders = {
  "Access-Control-Allow-Origin": process.env.FRONTEND_URL || "http://localhost:3000",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Credentials": "true"
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

// Delete address
export async function DELETE(
  req: Request,
  { params }: { params: { storeId: string; addressId: string } }
) {
  try {
    const clerkId = await getCustomerIdFromRequest(req);
    if (!clerkId) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    // Get customer and verify address ownership
    const customer = await prismadb.customer.findUnique({
      where: { clerkId }
    });

    if (!customer) {
      return new NextResponse("Customer not found", { status: 404 });
    }

    // Verify address belongs to this customer
    const address = await prismadb.customerAddress.findFirst({
      where: {
        id: params.addressId,
        customerId: customer.id
      }
    });

    if (!address) {
      return new NextResponse("Address not found", { status: 404 });
    }

    // Delete the address
    await prismadb.customerAddress.delete({
      where: { id: params.addressId }
    });

    return NextResponse.json({ success: true }, { headers: corsHeaders });
  } catch (error) {
    console.log('[ADDRESS_DELETE]', error);
    return new NextResponse("Internal error", { status: 500 });
  }
}

// Set address as default
export async function PUT(
  req: Request,
  { params }: { params: { storeId: string; addressId: string } }
) {
  try {
    const clerkId = await getCustomerIdFromRequest(req);
    if (!clerkId) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    // Get customer and verify address ownership
    const customer = await prismadb.customer.findUnique({
      where: { clerkId }
    });

    if (!customer) {
      return new NextResponse("Customer not found", { status: 404 });
    }

    // Verify address belongs to this customer
    const address = await prismadb.customerAddress.findFirst({
      where: {
        id: params.addressId,
        customerId: customer.id
      }
    });

    if (!address) {
      return new NextResponse("Address not found", { status: 404 });
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

    return NextResponse.json(updatedAddress, { headers: corsHeaders });
  } catch (error) {
    console.log('[ADDRESS_SET_DEFAULT]', error);
    return new NextResponse("Internal error", { status: 500 });
  }
}
