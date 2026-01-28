require('dotenv').config();
const { Client, GatewayIntentBits, Events } = require('discord.js');
const { neon } = require('@neondatabase/serverless');

if (!process.env.DATABASE_URL) {
    console.error("❌ Error: DATABASE_URL is not defined in the environment.");
    process.exit(1);
}

const sql = neon(process.env.DATABASE_URL);

if (!process.env.DISCORD_TOKEN) {
    console.error("❌ Error: DISCORD_TOKEN is not defined in the environment.");
    process.exit(1);
}

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages
    ]
});

// Configure the roles that trigger a "Publisher" sync
const PUBLISHER_ROLE_NAME = 'Publisher'; // Change this if your role name is different

client.once(Events.ClientReady, (readyClient) => {
    console.log(`✅ Logged in as ${readyClient.user.tag}`);
    console.log("Listening for role changes and interactions...");
});

// 1. Handle Role Changes (Sync to DB)
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

// 2. Handle Button Interactions (Order Accept/Deny)
client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isButton()) return;

    // customId format: accept_order_123 or deny_order_123
    const [action, type, orderId] = interaction.customId.split('_');

    if (type === 'order') {
        const member = interaction.member;
        const isPublisher = member.roles.cache.some(role => role.name.toLowerCase() === PUBLISHER_ROLE_NAME.toLowerCase());

        if (!isPublisher) {
            return interaction.reply({
                content: `❌ Only users with the **${PUBLISHER_ROLE_NAME}** role can accept missions.`,
                ephemeral: true
            });
        }

        if (action === 'accept') {
            try {
                console.log(`📝 Processsing acceptance for Order #${orderId} by ${interaction.user.username}`);

                // Update Database Status to "ACCEPTED"
                await sql`
                    UPDATE orders 
                    SET status = 'ACCEPTED' 
                    WHERE id = ${parseInt(orderId)};
                `;

                // Respond to Discord
                await interaction.reply({
                    content: `✅ Mission #${orderId} accepted by ${interaction.user.username}!`,
                    ephemeral: false
                });

                // Disable the buttons so no one else can click them
                await interaction.message.edit({ components: [] });
            } catch (error) {
                console.error('❌ Failed to update order in DB:', error);
                await interaction.reply({ content: '❌ Error processing acceptance. Please try again.', ephemeral: true });
            }
        }

        if (action === 'deny') {
            await interaction.reply({ content: '❌ Mission denied.', ephemeral: true });
        }
    }
});

client.on('error', (error) => {
    console.error('❌ Discord Client Error:', error);
});

client.login(process.env.DISCORD_TOKEN);
