import { NextResponse } from 'next/server';
import { createOrderService } from "../../../lib/services/orderService";
import { logger } from "../../../utils/logger";

export async function POST(req: Request) {
    logger.info(`[Orders API] POST request received`);

    try {
        const body = await req.json();
        const { rawInput, productLink, reward } = body;

        if (!rawInput || !productLink || reward === undefined) {
            logger.warn('[Orders API] Missing required fields in request body');
            return NextResponse.json({ error: "Missing required fields (rawInput, productLink, reward)" }, { status: 400 });
        }

        logger.info({ reward }, '[Orders API] Creating new order');
        const result = await createOrderService(rawInput, productLink, Number(reward));

        logger.info({ orderId: result.order.id }, '[Orders API] Order created successfully');
        return NextResponse.json(result, { status: 201 });
    } catch (error) {
        const err = error as Error;
        logger.error({ error: err.message }, '[Orders API] Failed to create order');
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
