import { NextResponse } from 'next/server';
import { prisma } from "../../../../lib/prisma";
import { logger } from "../../../../utils/logger";
import { broadcastOrderToDiscord } from "../../../../lib/services/orderService";

export async function POST(req: Request) {
    logger.info('[CrewAI Webhook] Received webhook call');

    try {
        const body = await req.json();
        logger.info({ body }, '[CrewAI Webhook] Webhook body parsed');

        const { result, kickoff_id } = body;

        if (!kickoff_id) {
            logger.warn('[CrewAI Webhook] Missing kickoff_id in body');
            return NextResponse.json({ error: "Missing kickoff_id" }, { status: 400 });
        }

        // Find the order by kickoffId
        const order = await prisma.order.findFirst({
            where: { kickoffId: kickoff_id }
        });

        if (!order) {
            logger.error({ kickoff_id }, '[CrewAI Webhook] Order not found for kickoff_id');
            return NextResponse.json({ error: "Order not found" }, { status: 404 });
        }

        logger.info({ orderId: order.id }, '[CrewAI Webhook] Found order, updating with result');

        // Update order with result and change status to OPEN
        const updatedOrder = await prisma.order.update({
            where: { id: order.id },
            data: {
                briefContent: result, // We use the result as the briefContent
                status: "OPEN"
            }
        });

        // Broadcast to Discord now that we have the final result
        logger.info({ orderId: order.id }, '[CrewAI Webhook] Broadcasting to Discord');
        await broadcastOrderToDiscord({
            orderId: updatedOrder.id,
            briefContent: result,
            productLink: updatedOrder.productLink || '',
            rawInput: updatedOrder.rawInput
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        const err = error as Error;
        logger.error({ error: err.message }, '[CrewAI Webhook] Webhook processing failed');
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
