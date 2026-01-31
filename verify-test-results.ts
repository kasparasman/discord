import { prisma } from "./src/lib/prisma";

async function verifyResults() {
    console.log("🔍 Checking Submission #26 for gathered stats...");

    try {
        const sub = await prisma.submission.findUnique({
            where: { id: 26 }
        });

        if (!sub) {
            console.log("❌ Submission #24 not found.");
            return;
        }

        console.log("\n--- TikTok Stats ---");
        console.log(`Views: ${sub.tiktokViews}`);
        console.log(`Likes: ${sub.tiktokLikes}`);
        console.log(`Thumbnail: ${(sub as any).tiktokThumbnailUrl}`);

        console.log("\n--- Instagram Stats ---");
        console.log(`Views: ${sub.igViews}`);
        console.log(`Likes: ${sub.igLikes}`);
        console.log(`Thumbnail: ${(sub as any).igThumbnailUrl}`);

        if (sub.tiktokViews > 0 || sub.igViews > 0) {
            console.log("\n✨ SUCCESS: Stats have been gathered!");
            if ((sub as any).tiktokThumbnailUrl || (sub as any).igThumbnailUrl) {
                console.log("🖼️  Thumbnails are also present!");
            }
        } else {
            console.log("\n⏳ Stats are still 0. Scrapers might still be running or mapping failed.");
        }

    } catch (error) {
        console.error("❌ Verification failed:", error);
    } finally {
        await prisma.$disconnect();
    }
}

verifyResults();
