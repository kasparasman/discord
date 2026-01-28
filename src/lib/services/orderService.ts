import { openai } from "@/lib/openai";
import { prisma } from "@/lib/prisma";
import { logger } from '@/utils/logger';
import { PrismaClient } from "@prisma/client";
import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';

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
    const db = prisma as unknown as PrismaClient;
    const newOrder = await db.order.create({
        data: {
            rawInput,
            briefContent: aiBrief || '',
            productLink,
            rewardAmount: reward,
            status: "OPEN"
        }
    });
    logger.info({ orderId: newOrder.id }, '[Order Service] Order saved to database');

    // 3. POST TO DISCORD (via Webhook - Forum Ready)
    if (process.env.DISCORD_ORDER_WEBHOOK_URL) {
        logger.info('[Order Service] Broadcasting to Discord');
        try {
            // Build the buttons
            const row = new ActionRowBuilder<ButtonBuilder>()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId(`accept_order_${newOrder.id}`)
                        .setLabel('Accept Mission')
                        .setStyle(ButtonStyle.Success),
                    new ButtonBuilder()
                        .setCustomId(`deny_order_${newOrder.id}`)
                        .setLabel('Deny')
                        .setStyle(ButtonStyle.Danger),
                );

            const discordRes = await fetch(process.env.DISCORD_ORDER_WEBHOOK_URL, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    username: "The Compiler",
                    avatar_url: "https://www.anthroposcity.com/logo.png",
                    thread_name: `ORDER #${newOrder.id} | ${rawInput.slice(0, 25).toUpperCase()}...`,
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
                    // Convert ActionRow to raw JSON for the webhook
                    components: [row.toJSON()]
                }),
            });
            logger.info({ statusCode: discordRes.status }, '[Order Service] Discord broadcast response');
        } catch (err) {
            const error = err as Error;
            logger.error({ error: error.message }, '[Order Service] Discord broadcast failed');
        }
    } else {
        logger.warn('[Order Service] DISCORD_ORDER_WEBHOOK_URL is not set');
    }

    return { success: true, order: newOrder };
}
