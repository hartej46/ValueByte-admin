import { NextResponse } from "next/server";
import prismadb from "@/lib/prismadb";

export async function GET(
    req: Request,
    { params }: { params: { storeId: string } }
) {
    try {
        const orders = await prismadb.order.findMany({
            where: {
                storeId: params.storeId,
            },
            take: 5,
            orderBy: {
                createdAt: "desc",
            },
            include: {
                customer: true,
            }
        });

        const debugData = orders.map(order => ({
            orderId: order.id,
            createdAt: order.createdAt,
            isPaid: order.isPaid,
            dbCustomerId: order.customerId,
            clerkId: order.customer?.clerkId || "NO_MATCHING_CUSTOMER",
            customerEmail: order.customer?.email,
            orderEmail: order.email
        }));

        return NextResponse.json(debugData);
    } catch (error: any) {
        return new NextResponse(`Debug Error: ${error.message}`, { status: 500 });
    }
}
