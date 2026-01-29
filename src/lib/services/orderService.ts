import { openai } from "../openai";
import { prisma } from "../prisma";
import { logger } from "../../utils/logger";

export async function createOrderService(rawInput: string, productLink: string, reward: number) {
    logger.info({ rawInput: rawInput.slice(0, 50) + '...' }, '[Order Service] Starting createOrderService');
    logger.info('[Order Service] Requesting AI compilation');

    const completion = await openai.chat.completions.create({
        model: "gpt-4-turbo",
        messages: [
            { role: "system", content: "You are the Viral Brief Compiler. Turn raw notes into a structured TikTok brief (Hook, Visual, Audio, CTA). Output clean Markdown. Be extremely professional and high-intensity." },
            { role: "user", content: rawInput }
        ]
    });

    const aiBrief = completion.choices[0].message.content;
    logger.info('[Order Service] AI compilation complete');

    logger.info('[Order Service] Saving order to database');
    const newOrder = await prisma.order.create({
        data: {
            rawInput,
            briefContent: aiBrief || '',
            productLink,
            rewardAmount: reward,
            status: "OPEN"
        }
    });
    logger.info({ orderId: newOrder.id }, '[Order Service] Order saved to database');

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

            const discordRes = await fetch(`https://discord.com/api/v10/channels/${process.env.DISCORD_FORUM_CHANNEL_ID}/threads`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bot ${process.env.DISCORD_TOKEN}`
                },
                body: JSON.stringify({
                    name: `ORDER #${newOrder.id} | ${rawInput.slice(0, 25).toUpperCase()}...`,
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
                                        name: "⏳ DEADLINE",
                                        value: "24 Hours",
                                        inline: true,
                                    },
                                    {
                                        name: "📦 ASSETS",
                                        value: `[Download Here](${productLink})`,
                                        inline: true,
                                    }
                                ],
                                footer: {
                                    text: "Discuss strategies below. Post final link in #submissions.",
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
                // Optional: Store the thread ID in the DB
                await prisma.order.update({
                    where: { id: newOrder.id },
                    data: { discordThreadId: responseData.id }
                });
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
