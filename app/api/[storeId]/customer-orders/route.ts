import { NextResponse } from "next/server";

import { verifyToken } from "@clerk/backend";

import prismadb from "@/lib/prismadb";

const corsHeaders = {
  "Access-Control-Allow-Origin": process.env.FRONTEND_URL || "*",
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

export async function GET(
  req: Request,
  { params }: { params: { storeId: string } }
) {
  try {
    if (!params.storeId) {
      return new NextResponse("Store ID is required", { status: 400 });
    }

    const customerId = await getCustomerIdFromRequest(req);

    if (!customerId) {
      return new NextResponse("Unauthenticated", { status: 401, headers: corsHeaders });
    }

    const orders = await prismadb.order.findMany({
      where: {
        storeId: params.storeId,
        customerId,
      } as any,
      include: {
        orderItems: {
          include: {
            product: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return NextResponse.json(orders, { headers: corsHeaders });
  } catch (error) {
    console.log("[CUSTOMER_ORDERS_GET]", error);
    return new NextResponse("Internal error", { status: 500, headers: corsHeaders });
  }
}
