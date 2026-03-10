const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
    const p = await prisma.product.findUnique({ where: { id: 2 } });
    console.log(p);
}

run().catch(console.error).finally(() => prisma.$disconnect());
