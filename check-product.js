const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const productId = 'a5e34b2a-ac01-4c20-90af-b6dde30e5149';

    try {
        const product = await prisma.product.findUnique({
            where: { id: productId },
            include: {
                orderItems: true,
            }
        });

        if (!product) {
            console.log('Product not found');
            return;
        }

        console.log('Product Details:');
        console.log(`Name: ${product.name}`);
        console.log(`Order Items Count: ${product.orderItems.length}`);

        if (product.orderItems.length > 0) {
            console.log('This product is linked to orders and cannot be deleted easily.');
            console.log('Order Item IDs:', product.orderItems.map(item => item.id));
        } else {
            console.log('This product is not linked to any orders.');
        }
    } catch (error) {
        console.error('Error:', error);
    } finally {
        await prisma.$disconnect();
    }
}

main();
