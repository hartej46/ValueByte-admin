import { NextResponse } from "next/server";
import crypto from "crypto";
import prismadb from "@/lib/prismadb";
import { getCorsHeaders } from "@/lib/cors";



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
    try {
        const {
            razorpay_order_id,
            razorpay_payment_id,
            razorpay_signature,
            orderId
        } = await req.json();

        if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !orderId) {
            return new NextResponse("Missing required fields", {
                status: 400,
                headers: getCorsHeaders(req.headers.get('origin'))
            });
        }

        const body = razorpay_order_id + "|" + razorpay_payment_id;
        const expectedSignature = crypto
            .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET!)
            .update(body.toString())
            .digest("hex");

        const isAuthentic = expectedSignature === razorpay_signature;

        if (isAuthentic) {
            const order = await prismadb.order.update({
                where: { id: orderId },
                data: {
                    isPaid: true,
                },
                include: {
                    orderItems: true
                }
            });

            // Update stock for each product in the order
            for (const item of order.orderItems) {
                await prismadb.product.update({
                    where: { id: item.productId },
                    data: {
                        stock: {
                            decrement: item.quantity
                        }
                    }
                });
            }

            return NextResponse.json({ message: "Payment verified successfully" }, {
                headers: getCorsHeaders(req.headers.get('origin'))
            });
        } else {
            return new NextResponse("Invalid signature", {
                status: 400,
                headers: getCorsHeaders(req.headers.get('origin'))
            });
        }
    } catch (error) {
        console.log("[RAZORPAY_VERIFY_POST]", error);
        return new NextResponse("Internal error", {
            status: 500,
            headers: getCorsHeaders(req.headers.get('origin'))
        });
    }
}
