import { prisma } from "./src/lib/prisma";

async function verifyResults() {
    console.log("🔍 Checking Submission #24 for gathered stats...");

    try {
        const sub = await prisma.submission.findUnique({
            where: { id: 24 }
        });

        if (!sub) {
            console.log("❌ Submission #24 not found.");
            return;
        }

        console.log("\n--- TikTok Stats ---");
        console.log(`Views: ${sub.tiktokViews}`);
        console.log(`Likes: ${sub.tiktokLikes}`);
        console.log(`Shares: ${sub.tiktokShares}`);

        console.log("\n--- Instagram Stats ---");
        console.log(`Views: ${sub.igViews}`);
        console.log(`Likes: ${sub.igLikes}`);
        console.log(`Comments: ${sub.igComments}`);

        if (sub.tiktokViews > 0 || sub.igViews > 0) {
            console.log("\n✨ SUCCESS: Stats have been gathered!");
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
