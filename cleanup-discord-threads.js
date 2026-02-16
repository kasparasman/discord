const fs = require('fs');
const path = require('path');

// 1. Load ENVs in order of priority: .env.local (if exists) then .env
if (fs.existsSync(path.join(__dirname, '.env.local'))) {
    require('dotenv').config({ path: '.env.local' });
}
require('dotenv').config();

const { Client, GatewayIntentBits } = require('discord.js');

const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const CHANNEL_ID = process.env.DISCORD_FORUM_CHANNEL_ID;

if (!DISCORD_TOKEN || !CHANNEL_ID) {
    console.error('❌ DISCORD_TOKEN or DISCORD_FORUM_CHANNEL_ID missing in .env');
    process.exit(1);
}

const client = new Client({
    intents: [GatewayIntentBits.Guilds]
});

client.once('ready', async () => {
    console.log(`✅ Logged in as ${client.user.tag}`);

    try {
        const channel = await client.channels.fetch(CHANNEL_ID);
        if (!channel) {
            console.error('❌ Could not find channel.');
            process.exit(1);
        }

        console.log(`🔍 Fetching threads in channel: ${channel.name} (${CHANNEL_ID})...`);

        // Fetch active threads
        const activeThreads = await channel.threads.fetchActive();
        // Fetch archived threads (to be thorough)
        const archivedThreads = await channel.threads.fetchArchived();

        const allThreads = [
            ...activeThreads.threads.values(),
            ...archivedThreads.threads.values()
        ];

        console.log(`Found ${allThreads.length} total threads (active + archived).`);

        for (const thread of allThreads) {
            console.log(`🗑️ Deleting thread: ${thread.name} (${thread.id})...`);
            await thread.delete();
            console.log(`✅ Deleted.`);
            // Throttle slightly
            await new Promise(r => setTimeout(r, 200));
        }

        console.log('🏁 Cleanup complete.');
    } catch (error) {
        console.error('❌ Cleanup failed:', error);
    } finally {
        client.destroy();
    }
});

client.login(DISCORD_TOKEN);
