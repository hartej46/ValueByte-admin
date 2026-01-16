import { headers } from "next/headers";
import { NextResponse } from "next/server";
import crypto from "crypto";
import prismadb from "@/lib/prismadb";

export async function POST(req: Request) {
    try {
        const body = await req.text();
        const signature = headers().get("x-razorpay-signature");

        if (!signature) {
            return new NextResponse("Missing signature", { status: 400 });
        }

        const secret = process.env.RAZORPAY_WEBHOOK_SECRET;

        if (!secret) {
            // If secret is not configured, we can't verify, but we shouldn't crash.
            // Returing 200 to acknowledge receipt but logging error.
            console.error("[RAZORPAY_WEBHOOK] RAZORPAY_WEBHOOK_SECRET is not set");
            return new NextResponse("Webhook secret not configured", { status: 500 });
        }

        const expectedSignature = crypto
            .createHmac("sha256", secret)
            .update(body)
            .digest("hex");

        if (expectedSignature !== signature) {
            return new NextResponse("Invalid signature", { status: 400 });
        }

        const event = JSON.parse(body);

        if (event.event === "order.paid") {
            const payment = event.payload.payment.entity;
            const orderId = payment.notes.orderId;

            if (orderId) {
                await prismadb.order.update({
                    where: {
                        id: orderId,
                    },
                    data: {
                        isPaid: true,
                        mobile: payment.contact || "",
                        email: payment.email || "",
                    },
                });

                // Stock decrement logic is handled in verify route usually, 
                // but robust webhook might want to ensure it too.
                // For now, focusing on isPaid status.
            }
        }

        return new NextResponse(null, { status: 200 });
    } catch (error: any) {
        console.error("[RAZORPAY_WEBHOOK_ERROR]", error);
        return new NextResponse(`Webhook Error: ${error.message}`, { status: 500 });
    }
}
