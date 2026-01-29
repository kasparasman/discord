require('dotenv').config();
const { Client, GatewayIntentBits, Events, MessageFlags } = require('discord.js');
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

    const [action, type, orderId] = interaction.customId.split('_');
    if (type !== 'order') return;

    const member = interaction.member;
    const isPublisher = member.roles.cache.some(role => role.name.toLowerCase() === PUBLISHER_ROLE_NAME.toLowerCase());

    if (!isPublisher) {
        return interaction.reply({
            content: `❌ Only users with the **${PUBLISHER_ROLE_NAME}** role can accept missions.`,
            flags: [MessageFlags.Ephemeral]
        });
    }

    if (action === 'accept') {
        try {
            console.log(`📝 Processing pool entry for Order #${orderId} by ${interaction.user.username}`);

            // 1. HARD GATE CHECK: Verify if enrollment period is over (24h)
            const [order] = await sql`
                SELECT created_at FROM orders WHERE id = ${parseInt(orderId)} LIMIT 1;
            `;

            if (!order) {
                return interaction.reply({ content: "❌ Error: Order not found.", flags: [MessageFlags.Ephemeral] });
            }

            const createdAt = new Date(order.created_at);
            const now = new Date();
            const hoursSinceCreation = (now - createdAt) / (1000 * 60 * 60);

            if (hoursSinceCreation > 24) {
                return interaction.reply({
                    content: "❌ **Intake Closed.** You missed the 24-hour enrollment window for this production cycle.",
                    flags: [MessageFlags.Ephemeral]
                });
            }

            // 2. Ensure the Publisher exists (Upsert)
            const [localPublisher] = await sql`
                INSERT INTO publishers (discord_id, username, is_active)
                VALUES (${interaction.user.id}, ${interaction.user.username}, true)
                ON CONFLICT (discord_id) 
                DO UPDATE SET username = EXCLUDED.username
                RETURNING id;
            `;

            // 3. CHECK FOR DUPLICATE: Has this user already accepted?
            const [existing] = await sql`
                SELECT id FROM order_participants 
                WHERE order_id = ${parseInt(orderId)} 
                AND publisher_id = ${localPublisher.id}
                LIMIT 1;
            `;

            if (existing) {
                return interaction.reply({
                    content: `👋 You've already joined the pool for **Mission #${orderId}**. Stay tuned!`,
                    flags: [MessageFlags.Ephemeral]
                });
            }

            // 4. Add to the Order Pool (order_participants table)
            await sql`
                INSERT INTO order_participants (order_id, publisher_id)
                VALUES (${parseInt(orderId)}, ${localPublisher.id});
            `;

            // 5. Simple confirmation
            await interaction.reply({
                content: `✅ **Enrolled!** You have been added to the participant pool. You have **24 hours** from now (48h total from post) to complete your submission. 🚀`,
                flags: [MessageFlags.Ephemeral]
            });

        } catch (error) {
            console.error('❌ Failed to process pool entry:', error);
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp({ content: '❌ Error joining the pool. Please try again.', flags: [MessageFlags.Ephemeral] });
            } else {
                await interaction.reply({ content: '❌ Error joining the pool. Please try again.', flags: [MessageFlags.Ephemeral] });
            }
        }
    }

    if (action === 'deny') {
        await interaction.reply({ content: '❌ Mission denied. Feel free to ignore.', flags: [MessageFlags.Ephemeral] });
    }
});

client.on('error', (error) => {
    console.error('❌ Discord Client Error:', error);
});

client.login(process.env.DISCORD_TOKEN);
