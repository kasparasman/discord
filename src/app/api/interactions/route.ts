import { InteractionType, InteractionResponseType, verifyKey } from 'discord-interactions';

// export const runtime = 'edge'; // High-level: Use Edge for speed

export async function POST(req: Request) {
    const signature = req.headers.get('x-signature-ed25519');
    const timestamp = req.headers.get('x-signature-timestamp');
    const rawBody = await req.text();

    // 1. Verify the request
    const isValidRequest = await verifyKey(
        rawBody,
        signature!,
        timestamp!,
        process.env.DISCORD_PUBLIC_KEY!
    );

    if (!isValidRequest) {
        return new Response('Invalid request signature', { status: 401 });
    }

    const interaction = JSON.parse(rawBody);

    // 2. Handle PING (Verification)
    if (interaction.type === InteractionType.PING) {
        return Response.json({ type: InteractionResponseType.PONG });
    }

    // 3. Handle Other Interactions (Fallback)
    // If you want to handle buttons here, you would add logic for interaction.data.custom_id
    // For now, we return a 200 to acknowledge, but it's best to remove the URL from Dev Portal
    // so that the bot.js Gateway listener handles it instead.
    return new Response('Handled', { status: 200 });
}

export async function GET() {
    return new Response('Discord Interactions endpoint is active. Use POST for interactions.', {
        status: 200,
    });
}
