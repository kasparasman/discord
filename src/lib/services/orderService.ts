import { openai } from "../openai";
import { prisma } from "../prisma";
import { logger } from "../../utils/logger";

export async function createOrderService(rawInput: string, productLink: string, reward: number) {
    logger.info({ rawInput: rawInput.slice(0, 50) + '...' }, '[Order Service] Starting createOrderService');
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
        logger.info('[Order Service] Broadcasting to Discord Forum');
        try {
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
                            style: 4, // Danger (Red)
                            label: "Deny",
                            custom_id: `deny_order_${newOrder.id}`
                        }
                    ]
                }
            ];

            const nowUnix = Math.floor(Date.now() / 1000);
            const enrollmentUnix = nowUnix + (24 * 60 * 60); // 24 hours
            const submissionUnix = nowUnix + (48 * 60 * 60); // 48 hours

            const discordRes = await fetch(`https://discord.com/api/v10/channels/${process.env.DISCORD_FORUM_CHANNEL_ID}/threads`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bot ${process.env.DISCORD_TOKEN}`
                },
                body: JSON.stringify({
                    name: `ORDER #${newOrder.id} | ${rawInput.slice(0, 25).toUpperCase()}...`,
                    applied_tags: ["1466317856399425557"], // [Open Order] Tag
                    message: {
                        embeds: [
                            {
                                title: "📄 MISSION BRIEFING",
                                description: aiBrief,
                                color: 5763719,
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
                                    text: "Once enrollment closes, you cannot enter this production cycle.",
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
                logger.info({ threadId: responseData.id }, '[Order Service] Discord thread created with buttons');

                newOrder = await prisma.order.update({
                    where: { id: newOrder.id },
                    data: {
                        discordThreadId: responseData.id,
                        enrollmentExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
                        submissionExpiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000)
                    }
                });

                // --- QSTASH SCHEDULING ---
                if (process.env.QSTASH_TOKEN && process.env.APP_URL) {
                    logger.info('[Order Service] Scheduling mission phases via QStash');
                    const qstashUrl = `https://qstash.upstash.io/v2/publish/${process.env.APP_URL}/api/expire-enrollment`;

                    // Phase 1: Close Enrollment (24h)
                    await fetch(qstashUrl, {
                        method: "POST",
                        headers: {
                            "Authorization": `Bearer ${process.env.QSTASH_TOKEN}`,
                            "Content-Type": "application/json",
                            "Upstash-Delay": "24h"
                        },
                        body: JSON.stringify({
                            orderId: newOrder.id,
                            threadId: responseData.id,
                            phase: 'ENROLLMENT_CLOSED'
                        })
                    });

                    // Phase 2: Submission Deadline (48h)
                    await fetch(qstashUrl, {
                        method: "POST",
                        headers: {
                            "Authorization": `Bearer ${process.env.QSTASH_TOKEN}`,
                            "Content-Type": "application/json",
                            "Upstash-Delay": "48h"
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
