import { NextResponse } from 'next/server';
import { createOrderService } from "../../../lib/services/orderService";
import { logger } from "../../../utils/logger";

export async function POST(req: Request) {
    logger.info(`[Orders API] POST request received`);

    try {
        const body = await req.json();
        logger.info({ body }, '[Orders API] Request body parsed');
        const { rawInput, productLink, productId, userInputMessage } = body;

        // Allow either traditional rawInput/productLink OR the new productId/userInputMessage flow
        const isValidTraditional = rawInput && productLink !== undefined;
        const isValidNewFlow = productId !== undefined;

        if (!isValidTraditional && !isValidNewFlow) {
            logger.warn({ body }, '[Orders API] Validation failed: missing required fields');
            return NextResponse.json({ error: "Missing required fields (rawInput/productLink or productId)" }, { status: 400 });
        }

        logger.info({ productId, userInputMessage }, '[Orders API] Processing order request');
        const result = await createOrderService(rawInput || '', productLink || '', productId, userInputMessage);

        logger.info({ orderId: result.order.id }, '[Orders API] Order created successfully');
        return NextResponse.json(result, { status: 201 });
    } catch (error) {
        const err = error as Error;
        logger.error({ error: err.message }, '[Orders API] Failed to create order');
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
