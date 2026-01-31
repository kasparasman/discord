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

        // Only track if there are submissions - Normalize URLs to ensure stable matching keys
        const tiktokLinks = order.submissions
            .filter((s) => s.tiktokLink && s.tiktokLink.includes('tiktok.com'))
            .map((s) => s.tiktokLink.split('?')[0]); // Use clean URL as the key

        const instagramLinks = order.submissions
            .filter((s) => s.instagramLink && s.instagramLink.includes('instagram.com'))
            .map((s) => s.instagramLink.split('?')[0]); // Use clean URL as the key

        if (tiktokLinks.length === 0 && instagramLinks.length === 0) {
            logger.info({ orderId }, '[Track API] No links to scrape. Skipping cycle.');
            return NextResponse.json({ message: 'No links to scrape' });
        }

        const isTest = process.env.TEST_MODE === 'true';
        const maxScrapes = isTest ? 2 : 10;

        if (order.scrapeCount >= maxScrapes) {
            return NextResponse.json({ message: `Tracking complete (${order.scrapeCount}/${maxScrapes})` });
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
            logger.info({ orderId, count: newCount }, '[Track API] Launching scrapers');

            const client = new ApifyClient({ token: process.env.APIFY_TOKEN });
            const secret = process.env.APIFY_WEBHOOK_SECRET;
            if (!secret) {
                logger.error('[Track API] APIFY_WEBHOOK_SECRET is not defined. Aborting run.');
                throw new Error('APIFY_WEBHOOK_SECRET missing');
            }

            const baseWebhookUrl = `${process.env.APP_URL}/api/apify-webhook?orderId=${orderId}&secret=${secret}`;

            // TikTok Scrape
            if (tiktokLinks.length > 0) {
                const tiktokWebhookUrl = `${baseWebhookUrl}&platform=tiktok`;
                await client.actor('GdWCkxBtKWOsKjdch').start({
                    postURLs: tiktokLinks,
                    resultsPerPage: 100,
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
                            requestUrl: tiktokWebhookUrl,
                            idempotencyKey: `webhook-tt-${orderId}-${newCount}`
                        },
                    ],
                });
                logger.info({ orderId }, '[Track API] TikTok actor started');
            }

            // Instagram Scrape
            if (instagramLinks.length > 0) {
                const igWebhookUrl = `${baseWebhookUrl}&platform=instagram`;
                await client.actor('shu8hvrXbJbY3Eb9W').start({
                    "directUrls": instagramLinks,
                    "resultsType": "posts",
                    "resultsLimit": instagramLinks.length * 2,
                    "searchType": "hashtag",
                    "searchLimit": 1,
                    "addParentData": false
                }, {
                    memory: 1024,
                    timeout: 300,
                    webhooks: [
                        {
                            eventTypes: ['ACTOR.RUN.SUCCEEDED'],
                            requestUrl: igWebhookUrl,
                            idempotencyKey: `webhook-ig-${orderId}-${newCount}`
                        },
                    ],
                });
                logger.info({ orderId }, '[Track API] Instagram actor started');
            }
        }




        // 3. SCHEDULE NEXT CALL VIA QSTASH
        if (newCount < maxScrapes) {
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
                logger.info({ orderId, newCount, delay, maxScrapes }, '[Track API] Next scrape scheduled');
            }
        } else {
            logger.info({ orderId, maxScrapes }, `[Track API] Tracking cycle finished (${newCount}/${maxScrapes})`);
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
