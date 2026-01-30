import { NextResponse } from 'next/server';
import { prisma } from "../../../lib/prisma";
import { logger } from '../../../utils/logger';
import { ApifyClient } from 'apify-client';

interface TikTokScrapeItem {
    webVideoUrl?: string;
    playCount?: number;
    diggCount?: number;
    shareCount?: number;
}

export async function POST(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const orderId = searchParams.get('orderId');
        const secret = searchParams.get('secret');

        // 1. Security Check
        const expectedSecret = process.env.APIFY_WEBHOOK_SECRET;
        if (!expectedSecret || secret !== expectedSecret) {
            logger.warn({ orderId }, '[Apify Webhook] Unauthorized request (invalid secret)');
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await req.json();
        const eventType = body.eventType;
        const actorRunId = body.eventData?.actorRunId;
        const datasetId = body.resource?.defaultDatasetId;

        // 2. Validate Event Type
        if (eventType !== 'ACTOR.RUN.SUCCEEDED') {
            logger.info({ eventType, actorRunId }, '[Apify Webhook] Skipping non-success event');
            return NextResponse.json({ message: 'Event ignored' });
        }

        if (!orderId || !datasetId) {
            logger.error({ orderId, datasetId }, '[Apify Webhook] Missing metadata in successful run');
            return NextResponse.json({ error: 'Missing metadata' }, { status: 400 });
        }

        logger.info({ orderId, actorRunId, datasetId }, '[Apify Webhook] Processing successful scrape results');

        // 2. Initialize Apify Client
        const client = new ApifyClient({ token: process.env.APIFY_TOKEN });

        // 3. Fetch data from Dataset
        const dataset = await client.dataset(datasetId).listItems({
            fields: ['webVideoUrl', 'playCount', 'diggCount', 'shareCount']
        });

        const items = dataset.items as TikTokScrapeItem[];

        // 4. Update Submissions
        for (const item of items) {
            const tiktokUrl = item.webVideoUrl;
            const views = item.playCount || 0;
            const likes = item.diggCount || 0;
            const shares = item.shareCount || 0;

            if (tiktokUrl) {
                // Find matching submission for this order
                const submission = await prisma.submission.findFirst({
                    where: {
                        orderId: parseInt(orderId),
                        tiktokLink: { contains: tiktokUrl.split('?')[0] } // Match without query params
                    }
                });

                if (submission) {
                    await prisma.submission.update({
                        where: { id: submission.id },
                        data: {
                            initialViews: views,
                            likes: likes,
                            shares: shares
                        }
                    });
                    logger.info({ submissionId: submission.id, views }, '[Apify Webhook] Updated submission stats');
                }
            }
        }

        return NextResponse.json({ success: true });

    } catch (err) {
        const error = err as Error;
        logger.error({ error: error.message }, '[Apify Webhook] Error');
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
