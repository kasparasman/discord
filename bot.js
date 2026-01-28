require('dotenv').config();
const { Client, GatewayIntentBits, Events } = require('discord.js');
const { neon } = require('@neondatabase/serverless');

const sql = neon(process.env.DATABASE_URL);

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers
    ]
});

// Configure the roles that trigger a "Publisher" sync
const PUBLISHER_ROLE_NAME = 'publisher'; // Change this if your role name is different

client.once(Events.ClientReady, (readyClient) => {
    console.log(`✅ Logged in as ${readyClient.user.tag}`);
    console.log("Listening for role changes...");
});

client.on(Events.GuildMemberUpdate, async (oldMember, newMember) => {
    const oldRoles = oldMember.roles.cache;
    const newRoles = newMember.roles.cache;

    const added = newRoles.filter(role => !oldRoles.has(role.id));
    const removed = oldRoles.filter(role => !newRoles.has(role.id));

    if (added.size > 0 || removed.size > 0) {
        console.log(`\n🔔 Role change detected for: ${newMember.user.tag} (${newMember.id})`);

        let shouldSync = false;

        added.forEach(role => {
            console.log(`   ➕ ADDED:   ${role.name} (${role.id})`);
            if (role.name.toLowerCase() === PUBLISHER_ROLE_NAME.toLowerCase()) shouldSync = true;
        });

        removed.forEach(role => {
            console.log(`   ➖ REMOVED: ${role.name} (${role.id})`);
            if (role.name.toLowerCase() === PUBLISHER_ROLE_NAME.toLowerCase()) shouldSync = true;
        });

        if (shouldSync) {
            const isNowPublisher = newMember.roles.cache.some(role => role.name.toLowerCase() === PUBLISHER_ROLE_NAME.toLowerCase());

            console.log(`🚀 Syncing ${newMember.user.username} to DB (Is Publisher: ${isNowPublisher})`);

            try {
                // Upsert logic into the 'publishers' table based on your Prisma schema
                await sql`
                    INSERT INTO publishers (discord_id, username, is_active)
                    VALUES (${newMember.id}, ${newMember.user.username}, ${isNowPublisher})
                    ON CONFLICT (discord_id)
                    DO UPDATE SET 
                        username = EXCLUDED.username,
                        is_active = EXCLUDED.is_active;
                `;
                console.log(`✅ Successfully synced ${newMember.user.username} to Neon DB.`);
            } catch (error) {
                console.error(`❌ DB Sync Error:`, error);
            }
        }
    }
});

client.on('error', (error) => {
    console.error('❌ Discord Client Error:', error);
});

client.login(process.env.DISCORD_TOKEN);
