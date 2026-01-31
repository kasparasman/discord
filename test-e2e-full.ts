import { ApifyClient } from 'apify-client';
import dotenv from 'dotenv';
import { prisma } from './src/lib/prisma';
import { uploadFromUrl } from './src/utils/s3';

dotenv.config();

const client = new ApifyClient({
    token: process.env.APIFY_TOKEN,
});

const SUB_ID = 26;

async function runE2ETest() {
    console.log('🚀 Starting E2E Scraper + S3 + DB Test...');

    const testUrls = [
        "https://www.tiktok.com/@h0ney229/video/7195017787113295130",
        "https://www.instagram.com/reel/DUJJ1W1iS-P/"
    ];

    try {
        // 1. TikTok Test
        console.log('\n--- 🎵 TikTok Actor Test ---');
        const ttRun = await client.actor("GdWCkxBtKWOsKjdch").call({
            postURLs: [testUrls[0]],
            commentsPerPost: 0,
            proxyCountryCode: "None",
            resultsPerPage: 1,
            shouldDownloadVideos: false,
        });

        const { items: ttItems } = await client.dataset(ttRun.defaultDatasetId).listItems();
        if (ttItems.length > 0) {
            const item = ttItems[0];
            const thumbUrl = (item.videoMeta as any)?.coverUrl;
            console.log('✅ TikTok Data Received. Thumbnail:', thumbUrl ? 'Found' : 'Missing');

            if (thumbUrl) {
                console.log('📂 Uploading TikTok thumbnail to S3...');
                const s3Url = await uploadFromUrl(thumbUrl, `test/tt_${SUB_ID}_${Date.now()}.jpg`);
                if (s3Url) {
                    console.log('✅ S3 Upload Success:', s3Url);
                    await prisma.$executeRawUnsafe(
                        `UPDATE "submissions" SET "tiktok_thumbnail_url" = $1 WHERE "id" = $2`,
                        s3Url, SUB_ID
                    );
                    console.log('💾 DB Updated.');
                }
            }
        }

        // 2. Instagram Test
        console.log('\n--- 📸 Instagram Reels Actor Test ---');
        const igRun = await client.actor("xMc5Ga1oCONPmWJIa").call({
            "username": [testUrls[1]],
            "resultsLimit": 1,
            "skipPinnedPosts": false,
            "includeSharesCount": true,
            "includeTranscript": false,
            "includeDownloadedVideo": false
        });

        const { items: igItems } = await client.dataset(igRun.defaultDatasetId).listItems();
        if (igItems.length > 0) {
            const item = igItems[0];
            const thumbUrl = item.displayUrl as string;
            console.log('✅ Instagram Data Received. Thumbnail:', thumbUrl ? 'Found' : 'Missing');

            if (thumbUrl) {
                console.log('📂 Uploading Instagram thumbnail to S3...');
                const s3Url = await uploadFromUrl(thumbUrl, `test/ig_${SUB_ID}_${Date.now()}.jpg`);
                if (s3Url) {
                    console.log('✅ S3 Upload Success:', s3Url);
                    await prisma.$executeRawUnsafe(
                        `UPDATE "submissions" SET "ig_thumbnail_url" = $1 WHERE "id" = $2`,
                        s3Url, SUB_ID
                    );
                    console.log('💾 DB Updated.');
                }
            }
        }

        // 3. Final Verification
        console.log('\n--- 🏁 Verification ---');
        const results: any[] = await prisma.$queryRawUnsafe(
            `SELECT "tiktok_thumbnail_url", "ig_thumbnail_url" FROM "submissions" WHERE "id" = $1`,
            SUB_ID
        );
        console.log('Final DB State:', results[0]);

    } catch (e: any) {
        console.error('❌ E2E Test Failed:', e.message);
    } finally {
        await prisma.$disconnect();
    }
}

runE2ETest();
