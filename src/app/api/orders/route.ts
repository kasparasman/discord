import { NextResponse } from 'next/server';
import { createOrderService } from "../../../lib/services/orderService";
import { logger } from "../../../utils/logger";

export async function POST(req: Request) {
    logger.info(`[Orders API] POST request received`);

    try {
        const body = await req.json();
        logger.info({ body }, '[Orders API] Request body parsed');
        const { rawInput, productLink } = body;

        if (!rawInput || productLink === undefined) {
            logger.warn({ rawInput, productLink }, '[Orders API] Validation failed: missing fields');
            return NextResponse.json({ error: "Missing required fields (rawInput, productLink)" }, { status: 400 });
        }

        logger.info({ rawInput, productLink }, '[Orders API] Creating new order');
        const result = await createOrderService(rawInput, productLink);

        logger.info({ orderId: result.order.id }, '[Orders API] Order created successfully');
        return NextResponse.json(result, { status: 201 });
    } catch (error) {
        const err = error as Error;
        logger.error({ error: err.message }, '[Orders API] Failed to create order');
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
