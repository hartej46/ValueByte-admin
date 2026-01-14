import { NextResponse } from "next/server";
import crypto from "crypto";
import prismadb from "@/lib/prismadb";

const corsHeaders = {
    "Access-Control-Allow-Origin": process.env.FRONTEND_URL || "http://localhost:3000",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Credentials": "true"
};

export async function OPTIONS() {
    return new NextResponse(null, { status: 200, headers: corsHeaders });
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
            return new NextResponse("Missing required fields", { status: 400, headers: corsHeaders });
        }

        const body = razorpay_order_id + "|" + razorpay_payment_id;
        const expectedSignature = crypto
            .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET!)
            .update(body.toString())
            .digest("hex");

        const isAuthentic = expectedSignature === razorpay_signature;

        if (isAuthentic) {
            await prismadb.order.update({
                where: { id: orderId },
                data: {
                    isPaid: true,
                    // You can also store the payment ID if needed
                }
            });

            return NextResponse.json({ message: "Payment verified successfully" }, { headers: corsHeaders });
        } else {
            return new NextResponse("Invalid signature", { status: 400, headers: corsHeaders });
        }
    } catch (error) {
        console.log("[RAZORPAY_VERIFY_POST]", error);
        return new NextResponse("Internal error", { status: 500, headers: corsHeaders });
    }
}
