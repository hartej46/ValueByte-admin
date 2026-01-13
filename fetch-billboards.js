
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const storeId = "6225b987-3000-4451-adef-0ce92e6b6f8d";
    const billboards = await prisma.billboard.findMany({
        where: { storeId }
    });
    console.log(JSON.stringify(billboards, null, 2));
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
