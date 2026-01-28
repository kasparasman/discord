import { InteractionType, InteractionResponseType, verifyKey } from 'discord-interactions';

export const runtime = 'edge'; // High-level: Use Edge for speed

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

  // 3. Handle Commands (Your Agent Logic goes here)
  return Response.json({
    type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
    data: { content: "Ninja Bot is alive!" },
  });
}
