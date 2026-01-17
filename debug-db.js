require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const STORE_ID = 'e337a82c-32a4-4df3-8b32-5cb06e393d72'; // From your .env URL

    if (!process.env.DATABASE_URL) {
        console.error("ERROR: DATABASE_URL is not set in .env");
        return;
    }
    console.log(`Database URL found: ${process.env.DATABASE_URL.substring(0, 20)}...`);

    console.log(`Checking orders for Store ID: ${STORE_ID}`);

    try {
        const orders = await prisma.order.findMany({
            where: {
                storeId: STORE_ID,
            },
            take: 5,
            orderBy: {
                createdAt: 'desc',
            },
            include: {
                customer: true,
            }
        });

        console.log(`Found ${orders.length} orders.`);

        orders.forEach(order => {
            console.log('--- Order ---');
            console.log(`ID: ${order.id}`);
            console.log(`Created: ${order.createdAt}`);
            console.log(`Paid: ${order.isPaid}`);
            console.log(`Amount: (Check Items)`);
            console.log(`Customer Link: ${order.customerId ? 'YES' : 'NO'}`);
            console.log(`Customer Clerk ID: ${order.customer?.clerkId}`);
            console.log(`Order Email: ${order.email}`);
            console.log(`Order Phone: ${order.phone || order.mobile}`);
        });

    } catch (error) {
        console.error('Error fetching orders:', error);
    } finally {
        await prisma.$disconnect();
    }
}

main();
