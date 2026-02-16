import { openai } from "../openai";
import { prisma } from "../prisma";
import { logger } from "../../utils/logger";

interface DiscordBroadcastOptions {
    orderId: number;
    briefContent: string;
    productLink: string;
    rawInput: string;
}

interface DiscordEmbed {
    title?: string;
    description?: string;
    color?: number;
    fields?: { name: string; value: string; inline?: boolean }[];
    footer?: { text: string };
    timestamp?: string;
}

function parseDossierToEmbeds(
    text: string,
    orderId: number,
    productLink: string,
    analyticsLink: string,
    enrollmentUnix: number,
    submissionUnix: number,
    WORKSHOP_CHANNEL_ID: string,
    isTest: boolean
): DiscordEmbed[] {
    const assetFields = [
        { name: "🏗️ WORKSHOP", value: `<#${WORKSHOP_CHANNEL_ID}>`, inline: true },
        { name: "📊 ANALYTICS", value: `[View Signal](${analyticsLink})`, inline: true },
    ];

    const isDossier = /ANTHROPOS|DOSSIER|NETWORK|PROTOCOL|FIELD MANUAL/i.test(text);

    if (!isDossier) {
        return [{
            title: isTest ? "🧪 TEST MISSION BRIEFING" : "📄 MISSION BRIEFING",
            description: text.slice(0, 4000),
            color: isTest ? 15548997 : 5763719,
            fields: [
                ...assetFields,
                { name: "📝 ENROLLMENT", value: `<t:${enrollmentUnix}:R>`, inline: true },
                { name: "🎬 DEADLINE", value: `<t:${submissionUnix}:R>`, inline: true }
            ],
            footer: { text: "STANDARD PROTOCOL ACTIVE" },
            timestamp: new Date().toISOString(),
        }];
    }

    // SPLIT BY H2 HEADERS (Resilient to Section numbers/titles)
    let sections = text.split(/(?=^#{2} )/m);

    // If splitting by ## failed (maybe only rules were used), fallback to rules or sections
    if (sections.length <= 1) {
        sections = text.split(/---/);
    }
    if (sections.length <= 1) {
        sections = text.split(/(?=^#{2,3} )/m);
    }

    const embeds: DiscordEmbed[] = [];

    sections.forEach((rawSection, idx) => {
        const content = rawSection.trim();
        if (!content) return;

        let title = "";
        let body = content;

        // Extract Title from ## or ###
        const headerMatch = content.match(/^(?:#{2,3})\s*([^\n]+)/m);
        if (headerMatch) {
            title = headerMatch[1].trim();
            body = content.replace(headerMatch[0], "").trim();
        }

        // --- SECTION SPECIFIC LOGIC ---

        // 1. CALLOUT ENHANCEMENT (Mechanism, Pivot, Energy)
        // Convert **Label:** to something more prominent
        body = body.replace(/\*\*(The Mechanism|The Pivot|The Energy|The Belief Install):\*\*/gi, (match) => `💡 **${match.toUpperCase()}**`);

        // 2. SECTION 3: SCRIPT SKELETON (VO & Visual Extraction)
        if (title.toUpperCase().includes("SCRIPT SKELETON") || title.includes("3.")) {
            body = body.replace(/^\*\s*\*\*Visual:\*\*/gm, "👁️ **VISUAL:**");
            body = body.replace(/^\*\s*\*\*VO:\*\*/gm, "🎙️ **VO:**");
        }

        // 3. SECTION 4: LAWS OF CONVERSION (Law/Why Mapping)
        if (title.toUpperCase().includes("LAWS OF CONVERSION") || title.includes("4.")) {
            // Find patterns like: * Law Name: Description + The WHY: Explanation
            body = body.replace(/^\*\s*\*\*([^*]+)\*\*/gm, "⚖️ **$1**");
            body = body.replace(/The WHY:/gi, "🧠 **THE WHY:**");
        }

        // 4. SECTION 5: CREATIVE AUTONOMY
        if (title.toUpperCase().includes("AUTONOMY") || title.includes("5.")) {
            body = body.replace(/^\*/gm, "📍");
        }

        // Subject Extraction for the first embed
        if (idx === 0) {
            const subjectMatch = text.match(/(?:SUBJECT|PRODUCT|FIELD MANUAL):\s*([^\n]+)/i);
            const subject = subjectMatch ? subjectMatch[1].trim() : (title || "CLASSIFIED");

            embeds.push({
                title: `📂 DOSSIER: ORDER #${orderId}`,
                description: `**SUBJECT: ${subject}**\n\n${body.slice(0, 2000)}`,
                color: 0x003366,
                fields: assetFields
            });
        } else {
            embeds.push({
                title: title.toUpperCase() || `PROTOCOL MODULE ${idx}`,
                description: body.slice(0, 4000),
                color: 0x003366
            });
        }
    });

    if (embeds.length === 0) {
        embeds.push({ title: `ORDER #${orderId}`, description: text.slice(0, 4000), color: 0x003366, fields: assetFields });
    }

    const lastEmbedIdx = Math.min(embeds.length - 1, 9);
    const lastEmbed = embeds[lastEmbedIdx];
    lastEmbed.fields = (lastEmbed.fields || []).concat([
        { name: "📝 ENROLLMENT", value: `<t:${enrollmentUnix}:R>`, inline: true },
        { name: "🎬 DEADLINE", value: `<t:${submissionUnix}:R>`, inline: true }
    ]);
    lastEmbed.footer = { text: isTest ? "🧪 TEST PROTOCOL" : "AUTHENTICATED BY ANTHROPOS NETWORK" };
    lastEmbed.timestamp = new Date().toISOString();

    return embeds.slice(0, 10);
}


export async function broadcastOrderToDiscord({ orderId, briefContent, productLink, rawInput }: DiscordBroadcastOptions) {
    const isTest = process.env.TEST_MODE === 'true';
    const enrollmentTimeMs = isTest ? 60 * 1000 : 24 * 60 * 60 * 1000;
    const submissionTimeMs = isTest ? 120 * 1000 : 48 * 60 * 60 * 1000;
    const enrollmentDelay = isTest ? "1m" : "24h";
    const submissionDelay = isTest ? "2m" : "48h";

    if (!process.env.DISCORD_TOKEN || !process.env.DISCORD_FORUM_CHANNEL_ID) {
        logger.warn('[Order Service] DISCORD_TOKEN or DISCORD_FORUM_CHANNEL_ID is not set');
        return;
    }

    logger.info({ orderId }, '[Order Service] Broadcasting to Discord');
    try {
        const WORKSHOP_CHANNEL_ID = "1464188183402119249";

        const components = [
            {
                type: 1, // Action Row
                components: [
                    {
                        type: 2, // Button
                        style: 3, // Success (Green)
                        label: "Accept Mission",
                        custom_id: `accept_order_${orderId}`
                    },
                    {
                        type: 2, // Button
                        style: 1, // Primary (Blue)
                        label: "Submit Video",
                        custom_id: `submit_order_${orderId}`
                    },
                    {
                        type: 2, // Button
                        style: 4, // Danger (Red)
                        label: "Deny",
                        custom_id: `deny_order_${orderId}`
                    }
                ]
            }
        ];

        const nowUnix = Math.floor(Date.now() / 1000);
        const enrollmentUnix = nowUnix + Math.floor(enrollmentTimeMs / 1000);
        const submissionUnix = nowUnix + Math.floor(submissionTimeMs / 1000);

        const analyticsLink = `${process.env.IS_PRODUCTION === 'true' ? 'https://anthroposcity.com' : 'https://preview.anthroposcity.com'}/network/analytics?platform=instagram&orderId=${orderId}`;

        const embeds = parseDossierToEmbeds(
            briefContent,
            orderId,
            productLink,
            analyticsLink,
            enrollmentUnix,
            submissionUnix,
            WORKSHOP_CHANNEL_ID,
            isTest
        );

        const discordRes = await fetch(`https://discord.com/api/v10/channels/${process.env.DISCORD_FORUM_CHANNEL_ID}/threads`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bot ${process.env.DISCORD_TOKEN}`
            },
            body: JSON.stringify({
                name: `ORDER #${orderId} | ${isTest ? '[TEST] ' : ''}${rawInput.slice(0, 20).toUpperCase()}...`,
                applied_tags: ["1466317856399425557"], // [Open Order] Tag
                message: {
                    embeds,
                    components
                }
            }),
        });

        const responseData = await discordRes.json();

        if (discordRes.ok) {
            logger.info({ threadId: responseData.id }, '[Order Service] Mission briefing thread created');

            await prisma.order.update({
                where: { id: orderId },
                data: {
                    discordThreadId: responseData.id,
                    enrollmentExpiresAt: new Date(Date.now() + enrollmentTimeMs),
                    submissionExpiresAt: new Date(Date.now() + submissionTimeMs)
                }
            });

            // --- QSTASH SCHEDULING ---
            if (process.env.QSTASH_TOKEN && process.env.APP_URL) {
                logger.info({ enrollmentDelay, submissionDelay }, '[Order Service] Scheduling mission phases via QStash');
                const qstashUrl = `https://qstash.upstash.io/v2/publish/${process.env.APP_URL}/network/api/expire-enrollment`;

                // Phase 1: Close Enrollment
                await fetch(qstashUrl, {
                    method: "POST",
                    headers: {
                        "Authorization": `Bearer ${process.env.QSTASH_TOKEN}`,
                        "Content-Type": "application/json",
                        "Upstash-Delay": enrollmentDelay
                    },
                    body: JSON.stringify({
                        orderId: orderId,
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
                        orderId: orderId,
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
}

export async function createOrderService(rawInput: string, productLink: string, productId?: number, userInputMessage?: string) {
    const isTest = process.env.TEST_MODE === 'true';
    logger.info({ rawInput: rawInput.slice(0, 50) + '...', isTest, productId }, '[Order Service] Starting createOrderService');

    let finalRawInput = rawInput;
    let finalProductLink = productLink;
    let finalBrief = '';
    let kickoffId: string | undefined;

    if (productId) {
        // --- NEW FLOW: CrewAI Integration ---
        const pId = Number(productId);
        logger.info({ productId: pId }, '[Order Service] Fetching product from DB');
        const product = await prisma.product.findUnique({
            where: { id: pId }
        });

        if (!product) {
            throw new Error(`Product with ID ${productId} not found`);
        }

        finalProductLink = product.link;
        finalRawInput = userInputMessage || product.description;

        // Save order first to get ID for webhook
        const newOrder = await prisma.order.create({
            data: {
                rawInput: finalRawInput,
                productLink: finalProductLink,
                status: "PENDING_CREWAI"
            }
        });

        logger.info({ orderId: newOrder.id }, '[Order Service] Order created, kicking off CrewAI');

        const crewWebhookUrl = `${process.env.APP_URL}/api/webhooks/crewai`;
        const crewApiUrl = "https://anthropos-order-8181b89e-a66c-4019-9ae3-472-bdb8118f.crewai.com/kickoff";

        // --- BYPASS LOGIC FOR FAST TESTING ---
        if (process.env.ENABLE_MOCK_CREWAI === 'true') {
            logger.info({ orderId: newOrder.id }, '[Order Service] ⚡ BYPASS ENABLED: Skipping CrewAI and simulating result');

            const mockKickoffId = `mock_${Date.now()}`;
            const mockDossier = `
# ANTHROPOS NETWORK DOSSIER: MOCK EXECUTION
---
## SUBJECT: FAST_TEST_BYPASS
**STATUS:** SIMULATED
**PURPOSE:** CHAIN_VERIFICATION

This is a mock dossier generated via the bypass protocol to test the delivery chain without consuming computational credits.
---
### PART A: INTELLIGENCE
The core signal is verified. This simulation confirms that the Discord formatting engine and thread creation logic are operational.
---
### PART B: EXECUTION
1. Launch bypass.
2. Verify delivery.
3. Confirm status.
            `.trim();

            // Update order immediately as if webhook already happened
            const updatedOrder = await prisma.order.update({
                where: { id: newOrder.id },
                data: {
                    kickoffId: mockKickoffId,
                    briefContent: mockDossier,
                    status: "OPEN"
                }
            });

            // Trigger Discord broadcast immediately
            await broadcastOrderToDiscord({
                orderId: updatedOrder.id,
                briefContent: mockDossier,
                productLink: updatedOrder.productLink || '',
                rawInput: updatedOrder.rawInput
            });

            return { success: true, order: updatedOrder, kickoffId: mockKickoffId };
        }

        try {
            const crewRes = await fetch(crewApiUrl, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${process.env.CREW_AI_TOKEN}`
                },
                body: JSON.stringify({
                    inputs: {
                        amazon_url: product.link,
                        product_image_url: product.imageUrl,
                        expert_input: finalRawInput
                    },
                    crewWebhookUrl
                })
            });

            if (!crewRes.ok) {
                const errorText = await crewRes.text();
                logger.error({ errorText }, '[Order Service] CrewAI kickoff failed');
                throw new Error(`CrewAI kickoff failed: ${errorText}`);
            }

            const crewData = await crewRes.json();
            kickoffId = crewData.kickoff_id;
            logger.info({ kickoffId }, '[Order Service] CrewAI kickoff successful');

            await prisma.order.update({
                where: { id: newOrder.id },
                data: { kickoffId }
            });

            return { success: true, order: newOrder, kickoffId };
        } catch (error) {
            logger.error({ error: (error as Error).message }, '[Order Service] CrewAI integration error');
            // We still return the order, but it might be stuck in PENDING_CREWAI
            return { success: true, order: newOrder, error: (error as Error).message };
        }
    } else {
        // --- TRADITIONAL FLOW: OpenAI ---
        logger.info('[Order Service] Requesting AI completion from OpenAI...');
        const completion = await openai.chat.completions.create({
            model: "gpt-4-turbo",
            messages: [
                { role: "system", content: "You are the Viral Brief Compiler. Turn raw notes into a structured TikTok brief (Hook, Visual, Audio, CTA). Output clean Markdown. Be extremely professional and high-intensity." },
                { role: "user", content: rawInput }
            ]
        });

        finalBrief = completion.choices[0].message.content || '';
        logger.info('[Order Service] AI compilation successful');

        const newOrder = await prisma.order.create({
            data: {
                rawInput: finalRawInput,
                briefContent: finalBrief,
                productLink: finalProductLink,
                status: "OPEN"
            }
        });

        logger.info({ orderId: newOrder.id }, '[Order Service] Order saved, broadcasting to Discord');

        // Finalize immediately for traditional flow
        await broadcastOrderToDiscord({
            orderId: newOrder.id,
            briefContent: finalBrief,
            productLink: finalProductLink,
            rawInput: finalRawInput
        });

        return { success: true, order: newOrder };
    }
}
