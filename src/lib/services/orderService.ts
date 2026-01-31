import { openai } from "../openai";
import { prisma } from "../prisma";
import { logger } from "../../utils/logger";

export async function createOrderService(rawInput: string, productLink: string, reward: number) {
    const isTest = process.env.TEST_MODE === 'true';
    logger.info({ rawInput: rawInput.slice(0, 50) + '...', isTest }, '[Order Service] Starting createOrderService');

    const enrollmentDelay = isTest ? "1m" : "24h";
    const submissionDelay = isTest ? "2m" : "48h";
    const enrollmentTimeMs = isTest ? 60 * 1000 : 24 * 60 * 60 * 1000;
    const submissionTimeMs = isTest ? 120 * 1000 : 48 * 60 * 60 * 1000;

    logger.info('[Order Service] Requesting AI completion from OpenAI...');
    const completion = await openai.chat.completions.create({
        model: "gpt-4-turbo",
        messages: [
            { role: "system", content: "You are the Viral Brief Compiler. Turn raw notes into a structured TikTok brief (Hook, Visual, Audio, CTA). Output clean Markdown. Be extremely professional and high-intensity." },
            { role: "user", content: rawInput }
        ]
    });

    const aiBrief = completion.choices[0].message.content;
    logger.info('[Order Service] AI compilation successful');

    logger.info('[Order Service] Attempting to save order to Neon DB...');
    let newOrder = await prisma.order.create({
        data: {
            rawInput,
            briefContent: aiBrief || '',
            productLink,
            rewardAmount: reward,
            status: "OPEN"
        }
    });
    logger.info({ orderId: newOrder.id }, '[Order Service] Order saved successfully');

    // 3. BROADCAST TO DISCORD (via BOT REST API)
    if (process.env.DISCORD_TOKEN && process.env.DISCORD_FORUM_CHANNEL_ID) {
        logger.info('[Order Service] Broadcasting to Discord');
        try {
            const WORKSHOP_CHANNEL_ID = "1464188183402119249";

            // --- STEP A: Create Mission Briefing Thread (Main Forum) ---
            const components = [
                {
                    type: 1, // Action Row
                    components: [
                        {
                            type: 2, // Button
                            style: 3, // Success (Green)
                            label: "Accept Mission",
                            custom_id: `accept_order_${newOrder.id}`
                        },
                        {
                            type: 2, // Button
                            style: 1, // Primary (Blue)
                            label: "Submit Video",
                            custom_id: `submit_order_${newOrder.id}`
                        },
                        {
                            type: 2, // Button
                            style: 4, // Danger (Red)
                            label: "Deny",
                            custom_id: `deny_order_${newOrder.id}`
                        }
                    ]
                }
            ];

            const nowUnix = Math.floor(Date.now() / 1000);
            const enrollmentUnix = nowUnix + Math.floor(enrollmentTimeMs / 1000);
            const submissionUnix = nowUnix + Math.floor(submissionTimeMs / 1000);

            const discordRes = await fetch(`https://discord.com/api/v10/channels/${process.env.DISCORD_FORUM_CHANNEL_ID}/threads`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bot ${process.env.DISCORD_TOKEN}`
                },
                body: JSON.stringify({
                    name: `ORDER #${newOrder.id} | ${isTest ? '[TEST] ' : ''}${rawInput.slice(0, 20).toUpperCase()}...`,
                    applied_tags: ["1466317856399425557"], // [Open Order] Tag
                    message: {
                        embeds: [
                            {
                                title: isTest ? "🧪 TEST MISSION BRIEFING" : "📄 MISSION BRIEFING",
                                description: aiBrief,
                                color: isTest ? 15548997 : 5763719,
                                fields: [
                                    {
                                        name: "💰 REWARD",
                                        value: `**${reward} ACT**`,
                                        inline: true,
                                    },
                                    {
                                        name: "📦 ASSETS",
                                        value: `[Download Here](${productLink})`,
                                        inline: true,
                                    },
                                    {
                                        name: "🏗️ PRODUCTION ROOM",
                                        value: `<#${WORKSHOP_CHANNEL_ID}>`,
                                        inline: true,
                                    },
                                    {
                                        name: "📊 LIVE ANALYTICS",
                                        value: `[View Performance](${process.env.IS_PRODUCTION === 'true' ? 'https://anthroposcity.com' : 'https://preview.anthroposcity.com'}/analytics?platform=instagram&orderId=${newOrder.id})`,
                                        inline: true,
                                    },
                                    {
                                        name: "📝 ENROLLMENT CLOSES",
                                        value: `<t:${enrollmentUnix}:R>`,
                                        inline: true,
                                    },
                                    {
                                        name: "🎬 SUBMISSION DEADLINE",
                                        value: `<t:${submissionUnix}:R>`,
                                        inline: false,
                                    }
                                ],
                                footer: {
                                    text: isTest ? "🧪 TEST MODE: Deadlines accelerated for testing." : "Once enrollment closes, you cannot enter this production cycle.",
                                },
                                timestamp: new Date().toISOString(),
                            },
                        ],
                        components
                    }
                }),
            });

            const responseData = await discordRes.json();

            if (discordRes.ok) {
                logger.info({ threadId: responseData.id }, '[Order Service] Mission briefing thread created');

                newOrder = await prisma.order.update({
                    where: { id: newOrder.id },
                    data: {
                        discordThreadId: responseData.id,
                        enrollmentExpiresAt: new Date(Date.now() + enrollmentTimeMs),
                        submissionExpiresAt: new Date(Date.now() + submissionTimeMs)
                    }
                });

                // --- QSTASH SCHEDULING ---
                if (process.env.QSTASH_TOKEN && process.env.APP_URL) {
                    logger.info({ enrollmentDelay, submissionDelay }, '[Order Service] Scheduling mission phases via QStash');
                    const qstashUrl = `https://qstash.upstash.io/v2/publish/${process.env.APP_URL}/api/expire-enrollment`;

                    // Phase 1: Close Enrollment
                    await fetch(qstashUrl, {
                        method: "POST",
                        headers: {
                            "Authorization": `Bearer ${process.env.QSTASH_TOKEN}`,
                            "Content-Type": "application/json",
                            "Upstash-Delay": enrollmentDelay
                        },
                        body: JSON.stringify({
                            orderId: newOrder.id,
                            threadId: responseData.id,
                            phase: 'ENROLLMENT_CLOSED'
                        })
                    });

                    // Phase 2: Submission Deadline
                    await fetch(qstashUrl, {
                        method: "POST",
                        headers: {
                            "Authorization": `Bearer ${process.env.QSTASH_TOKEN}`,
                            "Content-Type": "application/json",
                            "Upstash-Delay": submissionDelay
                        },
                        body: JSON.stringify({
                            orderId: newOrder.id,
                            threadId: responseData.id,
                            phase: 'SUBMISSION_CLOSED'
                        })
                    });
                } else {
                    logger.warn('[Order Service] QSTASH_TOKEN or APP_URL missing. Auto-expiration not scheduled.');
                }

            } else {
                logger.error({ error: responseData }, '[Order Service] Discord API returned error');
            }

        } catch (err) {
            const error = err as Error;
            logger.error({ error: error.message }, '[Order Service] Discord broadcast failed');
        }
    } else {
        logger.warn('[Order Service] DISCORD_TOKEN or DISCORD_FORUM_CHANNEL_ID is not set');
    }

    return { success: true, order: newOrder };
}
