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
        const platform = searchParams.get('platform');

        // 1. Security Check
        const expectedSecret = process.env.APIFY_WEBHOOK_SECRET;
        if (!expectedSecret || secret !== expectedSecret) {
            logger.warn({ orderId, platform }, '[Apify Webhook] Unauthorized request (invalid secret)');
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await req.json();
        const eventType = body.eventType;
        const actorRunId = body.eventData?.actorRunId;
        const datasetId = body.resource?.defaultDatasetId;

        // 2. Validate Event Type
        if (eventType !== 'ACTOR.RUN.SUCCEEDED') {
            logger.info({ eventType, actorRunId, platform }, '[Apify Webhook] Skipping non-success event');
            return NextResponse.json({ message: 'Event ignored' });
        }

        if (!orderId || !datasetId || !platform) {
            logger.error({ orderId, datasetId, platform }, '[Apify Webhook] Missing metadata in successful run');
            return NextResponse.json({ error: 'Missing metadata' }, { status: 400 });
        }

        logger.info({ orderId, platform, actorRunId, datasetId }, '[Apify Webhook] Processing successful scrape results');

        // 2. Initialize Apify Client
        const client = new ApifyClient({ token: process.env.APIFY_TOKEN });

        // 3. Fetch data from Dataset
        const dataset = await client.dataset(datasetId).listItems();
        const items = dataset.items;

        // 4. Update Submissions
        for (const item of items) {
            if (platform === 'tiktok') {
                const tiktokUrl = (item.webVideoUrl as string) || (item.url as string) || (item.directUrl as string);
                const views = (item.playCount as number) || 0;
                const likes = (item.diggCount as number) || 0;
                const shares = (item.shareCount as number) || 0;
                const comments = (item.commentCount as number) || 0;

                if (tiktokUrl) {
                    // Extract numeric ID from TikTok URL (e.g., /video/7195017787113295130)
                    const ttIdMatch = tiktokUrl.match(/\/video\/(\d+)/);
                    const ttId = ttIdMatch ? ttIdMatch[1] : null;

                    logger.info({ ttId, originalUrl: tiktokUrl }, '[Apify Webhook] Attempting TikTok match by ID');

                    const submission = await prisma.submission.findFirst({
                        where: {
                            orderId: parseInt(orderId),
                            tiktokLink: ttId ? { contains: ttId } : { contains: tiktokUrl.split('?')[0] }
                        }
                    });

                    if (submission) {
                        await prisma.submission.update({
                            where: { id: submission.id },
                            data: {
                                tiktokViews: views,
                                tiktokLikes: likes,
                                tiktokShares: shares,
                                tiktokComments: comments,
                            }
                        });
                        logger.info({ submissionId: submission.id, platform, views }, '[Apify Webhook] Updated TikTok stats');
                    }
                }
            } else if (platform === 'instagram') {
                const igUrl = (item.url as string) || (item.directUrl as string);
                const views = (item.videoPlayCount as number) || (item.playCount as number) || 0;
                const likes = (item.likesCount as number) || (item.displayLikesCount as number) || 0;
                const comments = (item.commentsCount as number) || 0;

                if (igUrl) {
                    // Extract shortcode from IG URL (handles /p/, /reel/, /reels/)
                    const igMatch = igUrl.match(/\/(?:p|reel|reels)\/([A-Za-z0-9_-]+)/);
                    const shortcode = igMatch ? igMatch[1] : null;

                    logger.info({ shortcode, originalUrl: igUrl }, '[Apify Webhook] Attempting Instagram match by Shortcode');

                    const submission = await prisma.submission.findFirst({
                        where: {
                            orderId: parseInt(orderId),
                            instagramLink: shortcode ? { contains: shortcode } : { contains: igUrl.split('?')[0] }
                        }
                    });

                    if (submission) {
                        await prisma.submission.update({
                            where: { id: submission.id },
                            data: {
                                igViews: views,
                                igLikes: likes,
                                igComments: comments
                            }
                        });
                        logger.info({ submissionId: submission.id, platform, views }, '[Apify Webhook] Updated Instagram stats');
                    }
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
