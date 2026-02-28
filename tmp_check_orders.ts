import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    const lastOrders = await prisma.order.findMany({
        take: 5,
        orderBy: { id: 'desc' },
        select: { id: true, status: true, rawInput: true }
    });
    console.log(JSON.stringify(lastOrders, null, 2));
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
