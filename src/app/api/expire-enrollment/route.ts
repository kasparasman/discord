import { NextResponse } from 'next/server';
import { prisma } from "../../../lib/prisma";
import { logger } from '../../../utils/logger';

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { orderId, threadId, phase } = body;

        if (!orderId || !threadId) {
            return NextResponse.json({ error: 'Missing logic data' }, { status: 400 });
        }

        logger.info({ orderId, threadId, phase }, '[Expire API] Phase trigger received');

        if (!process.env.DISCORD_TOKEN) {
            throw new Error('DISCORD_TOKEN missing');
        }

        // 1. HANDLE ENROLLMENT CLOSING (Phase 1)
        if (phase === 'ENROLLMENT_CLOSED') {
            const msgRes = await fetch(`https://discord.com/api/v10/channels/${threadId}/messages/${threadId}`, {
                headers: { "Authorization": `Bot ${process.env.DISCORD_TOKEN}` }
            });

            if (msgRes.ok) {
                const msgData = await msgRes.json();

                const disabledComponents = msgData.components.map((row: any) => ({
                    ...row,
                    components: row.components.map((btn: any) => ({
                        ...btn,
                        disabled: true
                    }))
                }));

                await fetch(`https://discord.com/api/v10/channels/${threadId}/messages/${threadId}`, {
                    method: "PATCH",
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bot ${process.env.DISCORD_TOKEN}`
                    },
                    body: JSON.stringify({ components: disabledComponents })
                });

                await fetch(`https://discord.com/api/v10/channels/${threadId}/messages`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bot ${process.env.DISCORD_TOKEN}`
                    },
                    body: JSON.stringify({
                        content: "🔒 **Enrollment Closed.** The 24-hour intake window has ended. No new participants can join."
                    })
                });

                await fetch(`https://discord.com/api/v10/channels/${threadId}`, {
                    method: "PATCH",
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bot ${process.env.DISCORD_TOKEN}`
                    },
                    body: JSON.stringify({
                        applied_tags: ["1466346095935230012"] // [In Progress]
                    })
                });

                // Sync DB Status
                await prisma.order.update({
                    where: { id: parseInt(orderId) },
                    data: { status: 'IN_PROGRESS' }
                });
            }
        }

        // 2. HANDLE SUBMISSION DEADLINE (Phase 2)
        if (phase === 'SUBMISSION_CLOSED') {
            await fetch(`https://discord.com/api/v10/channels/${threadId}/messages`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bot ${process.env.DISCORD_TOKEN}`
                },
                body: JSON.stringify({
                    content: "🏁 **Submission Deadline Hit.** The 48-hour submission window is now closed."
                })
            });

            await fetch(`https://discord.com/api/v10/channels/${threadId}`, {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bot ${process.env.DISCORD_TOKEN}`
                },
                body: JSON.stringify({
                    applied_tags: ["1466318304892293120"] // [Completed]
                })
            });

            // Sync DB Status
            await prisma.order.update({
                where: { id: parseInt(orderId) },
                data: { status: 'COMPLETED' }
            });
        }

        return NextResponse.json({ success: true, phase });

    } catch (err) {
        const error = err as Error;
        logger.error({ error: error.message }, '[Expire API] Phase transition failed');
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
