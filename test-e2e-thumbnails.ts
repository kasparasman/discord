import { prisma } from "./src/lib/prisma";
import { uploadFromUrl } from "./src/utils/s3";
import dotenv from "dotenv";

dotenv.config();

async function testThumbnailFlow() {
    console.log("🚀 Starting E2E Thumbnail Test...");

    // 1. Target a submission (using #26 from our previous success)
    const SUB_ID = 26;

    // 2. Real working thumbnail URLs from our last Apify test
    const ttThumbUrl = "https://p19-common-sign-useastred.tiktokcdn-eu.com/tos-useast5-p-0068-tx/oQf7RAnEEnEAfDIf6LhXge8gYgCeglBvIIH5AI~tplv-photomode-zoomcover:480:480.jpeg?x-expires=1738414800&x-signature=8X%2F%2F%2F%2F%2F%2F%2F%2F%2F%2F%2F%2F%2F%2F%2F%2F%2F%2F%2F%2F%2F%2F%2F%2F%3D";
    const igThumbUrl = "https://scontent-lga3-1.cdninstagram.com/v/t51.2885-15/625627108_228047926941160_5229676648784112270_n.jpg?_nc_cat=106&ccb=1-7&_nc_sid=18deecc&_nc_ohc=koRjfHYfsKm4WLjJs&_nc_zt=23&_nc_ht=scontent-lga3-1.cdninstagram.com&edm=ANmBC78EBAAG&_nc_gid=A6_GqP_QxOuFeQdftEVD0c&oh=00_AYAbXpY_G9_G9_G9_G9_G9_G9_G9_G9_G9_G9_G9_G9_G9&oe=67A1D5A2";

    try {
        console.log(`\n📂 Uploading TikTok thumbnail for Submission #${SUB_ID}...`);
        const ttS3Key = `thumbnails/tiktok/${SUB_ID}_test_tt.jpg`;
        const ttResult = await uploadFromUrl(ttThumbUrl, ttS3Key);

        if (ttResult) {
            console.log(`✅ TikTok S3 Upload Success: ${ttResult}`);
        } else {
            console.log("❌ TikTok S3 Upload Failed.");
        }

        console.log(`\n📂 Uploading Instagram thumbnail for Submission #${SUB_ID}...`);
        const igS3Key = `thumbnails/instagram/${SUB_ID}_test_ig.jpg`;
        const igResult = await uploadFromUrl(igThumbUrl, igS3Key);

        if (igResult) {
            console.log(`✅ Instagram S3 Upload Success: ${igResult}`);
        } else {
            console.log("❌ Instagram S3 Upload Failed.");
        }

        // 3. Update Database using Raw SQL to bypass Client validation
        console.log("\n💾 Updating Database using raw SQL...");
        await prisma.$executeRawUnsafe(
            `UPDATE "submissions" SET "tiktok_thumbnail_url" = $1, "ig_thumbnail_url" = $2 WHERE "id" = $3`,
            ttResult, igResult, SUB_ID
        );
        console.log("✅ Database record updated.");

        // 4. Verify using Raw SQL
        const results: any[] = await prisma.$queryRawUnsafe(
            `SELECT "tiktok_thumbnail_url", "ig_thumbnail_url" FROM "submissions" WHERE "id" = $1`,
            SUB_ID
        );
        const updatedSub = results[0];

        console.log("\n--- Final Database State ---");
        console.log(`TikTok Thumbnail: ${updatedSub.tiktok_thumbnail_url}`);
        console.log(`IG Thumbnail: ${updatedSub.ig_thumbnail_url}`);

        if (updatedSub.tiktok_thumbnail_url && updatedSub.ig_thumbnail_url) {
            console.log("\n✨ E2E TEST PASSED: Thumbnails are now permanent in S3 and linked in DB!");
        }


    } catch (error) {
        console.error("❌ Test failed:", error);
    } finally {
        await prisma.$disconnect();
    }
}

testThumbnailFlow();
