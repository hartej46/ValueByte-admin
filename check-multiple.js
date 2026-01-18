const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const ids = [
        'a5e34b2a-ac01-4c20-90af-b6dde30e5149',
        'a5e6947e-9379-4893-9f49-a9fee9242557'
    ];

    try {
        const products = await prisma.product.findMany({
            where: { id: { in: ids } },
            include: {
                orderItems: true,
            }
        });

        products.forEach(product => {
            console.log(`Product: ${product.name} (${product.id})`);
            console.log(`Order Items Count: ${product.orderItems.length}`);
            console.log('---');
        });
    } catch (error) {
        console.error('Error:', error);
    } finally {
        await prisma.$disconnect();
    }
}

main();
