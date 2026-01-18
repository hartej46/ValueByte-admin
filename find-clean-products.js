const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const STORE_ID = '64081b7c-751a-4c50-913b-5bbeaa9958ad';

    try {
        const products = await prisma.product.findMany({
            where: { storeId: STORE_ID },
            include: {
                orderItems: true,
            }
        });

        const cleanProducts = products.filter(p => p.orderItems.length === 0);
        console.log(`Total Products: ${products.length}`);
        console.log(`Products without orders: ${cleanProducts.length}`);

        if (cleanProducts.length > 0) {
            console.log('Sample clean product:');
            console.log(`Name: ${cleanProducts[0].name}`);
            console.log(`ID: ${cleanProducts[0].id}`);
        }
    } catch (error) {
        console.error('Error:', error);
    } finally {
        await prisma.$disconnect();
    }
}

main();
