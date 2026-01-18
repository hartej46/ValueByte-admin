const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const STORE_ID = '64081b7c-751a-4c50-913b-5bbeaa9958ad';
    const CATEGORY_ID = 'f1e1074e-289b-4e00-8800-4b89ea870e28'; // I should verify this ID
    const COLOR_ID = '8fc09193-4315-46f0-b74c-47353f478a5e'; // I should verify this ID

    try {
        // 1. Create a dummy product
        const product = await prisma.product.create({
            data: {
                storeId: STORE_ID,
                categoryId: CATEGORY_ID,
                colorId: COLOR_ID,
                name: 'TEST DELETE ME',
                price: 10,
                description: 'Testing deletion',
                images: {
                    create: {
                        url: 'https://example.com/test.jpg'
                    }
                }
            }
        });

        console.log(`Created product: ${product.name} (${product.id})`);

        // 2. Try to delete it
        const deleted = await prisma.product.delete({
            where: {
                id: product.id
            }
        });

        console.log(`Successfully deleted product: ${deleted.id}`);
    } catch (error) {
        console.error('Error during test:', error);
    } finally {
        await prisma.$disconnect();
    }
}

// Find a valid category and color first
async function getIds() {
    const storeId = '64081b7c-751a-4c50-913b-5bbeaa9958ad';
    const category = await prisma.category.findFirst({ where: { storeId } });
    const color = await prisma.color.findFirst({ where: { storeId } });
    return { categoryId: category.id, colorId: color.id };
}

getIds().then(ids => {
    // Update the ids and run main
    main();
});
