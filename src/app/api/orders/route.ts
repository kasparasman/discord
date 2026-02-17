import { NextResponse } from 'next/server';
import { createOrderService } from "../../../lib/services/orderService";
import { logger } from "../../../utils/logger";

export async function POST(req: Request) {
    logger.info(`[Orders API] POST request received`);

    try {
        const body = await req.json();
        logger.info({ body }, '[Orders API] Request body parsed');
        const { productId, rawInput, persona } = body;

        if (productId === undefined || !rawInput) {
            logger.warn({ body }, '[Orders API] Validation failed: missing productId or rawInput');
            return NextResponse.json({ error: "Missing required fields: productId and rawInput" }, { status: 400 });
        }

        logger.info({ productId, rawInput, persona }, '[Orders API] Processing order request');
        const result = await createOrderService(Number(productId), rawInput, persona);

        logger.info({ orderId: result.order.id }, '[Orders API] Order created successfully');
        return NextResponse.json(result, { status: 201 });
    } catch (error) {
        const err = error as Error;
        logger.error({ error: err.message }, '[Orders API] Failed to create order');
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
