import { prisma } from "./src/lib/prisma";
import dotenv from "dotenv";

dotenv.config();

async function setupTestData() {
    console.log("🛠️ Setting up minimal test data...");

    try {
        // 1. Create a dummy order matching the actual schema
        // rawInput is required by schema (line 492)
        const order = await prisma.order.create({
            data: {
                rawInput: "Test Input",
                briefContent: "Testing TT and IG gathering",
                scrapeCount: 0,
                isTracking: false
            }
        });

        console.log(`✅ Created Order #${order.id}`);

        // 2. Ensure a Publisher exists using actual schema
        // discordId is required and unique
        let publisher = await prisma.publisher.findUnique({
            where: { discordId: "777" }
        });

        if (!publisher) {
            publisher = await prisma.publisher.create({
                data: {
                    discordId: "777",
                    username: "testuser",
                    isActive: true
                }
            });
        }

        // 3. Create a submission with working links provided by the user
        const timestamp = Date.now();
        const submission = await prisma.submission.create({
            data: {
                orderId: order.id,
                userId: publisher.id,
                // Using URLs provided by the user
                tiktokLink: `https://www.tiktok.com/@h0ney229/video/7195017787113295130?test=${timestamp}`,
                instagramLink: `https://www.instagram.com/reel/DUJJ1W1iS-P/?test=${timestamp}`,
                reflection: "Testing with working links",
                status: "PENDING_REVIEW"
            }
        });


        console.log(`✅ Created Submission #${submission.id} for Order #${order.id}`);
        console.log("\n🚀 NEXT STEP: Trigger the track-order API with this curl command:");
        console.log(`curl -X POST http://localhost:3000/api/track-order -H "Content-Type: application/json" -d "{\\\"orderId\\\": ${order.id}}"`);

    } catch (error) {
        console.error("❌ Setup failed:", error);
    } finally {
        await prisma.$disconnect();
    }
}

setupTestData();
