import { NextResponse } from 'next/server';
import { prisma } from "../../../lib/prisma";
import { logger } from '../../../utils/logger';
import { ApifyClient } from 'apify-client';

export async function POST(req: Request) {
    try {
        const { orderId } = await req.json();

        if (!orderId) {
            return NextResponse.json({ error: 'Missing orderId' }, { status: 400 });
        }

        const order = await prisma.order.findUnique({
            where: { id: parseInt(orderId) },
            include: { submissions: true }
        });

        if (!order) {
            return NextResponse.json({ error: 'Order not found' }, { status: 404 });
        }

        // Only track if there are submissions
        const tiktokLinks = order.submissions
            .map((s) => s.tiktokLink)
            .filter((link): link is string => !!link && link.includes('tiktok.com'));

        if (tiktokLinks.length === 0) {
            logger.info({ orderId }, '[Track API] No TikTok links to scrape. Skipping cycle.');
            return NextResponse.json({ message: 'No links to scrape' });
        }

        if (order.scrapeCount >= 10) {
            return NextResponse.json({ message: 'Tracking complete (10/10)' });
        }

        // 1. INCREMENT COUNT & UPDATE STATUS FIRST
        const updatedOrder = await prisma.order.update({
            where: { id: parseInt(orderId) },
            data: {
                scrapeCount: { increment: 1 },
                isTracking: true,
                trackingStartedAt: order.trackingStartedAt || new Date()
            }
        });

        const newCount = updatedOrder.scrapeCount;

        // 2. CALL APIFY USING SDK
        if (process.env.APIFY_TOKEN) {
            logger.info({ orderId, count: newCount }, '[Track API] Launching Apify scrape via SDK');

            const client = new ApifyClient({ token: process.env.APIFY_TOKEN });

            const secret = process.env.APIFY_WEBHOOK_SECRET;
            if (!secret) {
                logger.error('[Track API] APIFY_WEBHOOK_SECRET is not defined. Aborting run.');
                throw new Error('APIFY_WEBHOOK_SECRET missing');
            }

            const webhookUrl = `${process.env.APP_URL}/api/apify-webhook?orderId=${orderId}&secret=${secret}`;

            await client.actor('GdWCkxBtKWOsKjdch').start({
                postURLs: tiktokLinks,
                resultsPerPage: 1000,
                profileScrapeSections: ["videos"],
                shouldDownloadVideos: false,
                shouldDownloadCovers: false,
                shouldDownloadSubtitles: false,
                shouldDownloadSlideshowImages: false,
                shouldDownloadAvatars: false,
                shouldDownloadMusicCovers: false,
            }, {
                memory: 1024,
                timeout: 300,
                webhooks: [
                    {
                        eventTypes: ['ACTOR.RUN.SUCCEEDED'],
                        requestUrl: webhookUrl,
                        idempotencyKey: `webhook-${orderId}-${newCount}`
                    },
                ],
            });

            logger.info({ orderId }, '[Track API] Apify actor started successfully');
        }

        // 3. SCHEDULE NEXT CALL VIA QSTASH
        if (newCount < 10) {
            const isTest = process.env.TEST_MODE === 'true';
            let delay = "12h";
            if (isTest) {
                delay = "1m";
            } else if (newCount < 4) {
                delay = "3h";
            } else if (newCount < 8) {
                delay = "6h";
            }

            if (process.env.QSTASH_TOKEN && process.env.APP_URL) {
                const qstashUrl = `https://qstash.upstash.io/v2/publish/${process.env.APP_URL}/api/track-order`;
                await fetch(qstashUrl, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${process.env.QSTASH_TOKEN}`,
                        'Content-Type': 'application/json',
                        'Upstash-Delay': delay
                    },
                    body: JSON.stringify({ orderId: orderId.toString() })
                });
                logger.info({ orderId, newCount, delay }, '[Track API] Next scrape scheduled');
            }
        } else {
            logger.info({ orderId }, '[Track API] Tracking cycle finished (10/10)');
            await prisma.order.update({
                where: { id: parseInt(orderId) },
                data: { isTracking: false }
            });
        }

        return NextResponse.json({ success: true, count: newCount });

    } catch (err) {
        const error = err as Error;
        logger.error({ error: error.message }, '[Track API] Failed');
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
