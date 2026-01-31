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

        // 3. Create a submission with real viral links for verification
        // Note: tiktokLink and instagramLink are @unique in current schema
        // We'll use random-ish strings to avoid conflicts if you run this multiple times
        const timestamp = Date.now();
        const submission = await prisma.submission.create({
            data: {
                orderId: order.id,
                userId: publisher.id,
                tiktokLink: `https://www.tiktok.com/@mrbeast/video/7463690615555460382?t=${timestamp}`,
                instagramLink: `https://www.instagram.com/reels/C-fGOf_SAs_/?t=${timestamp}`,
                reflection: "Testing the flow",
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
