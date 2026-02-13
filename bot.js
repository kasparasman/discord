const fs = require('fs');
const path = require('path');

// 1. Load ENVs in order of priority: .env.local (if exists) then .env
if (fs.existsSync(path.join(__dirname, '.env.local'))) {
    require('dotenv').config({ path: '.env.local' });
}
require('dotenv').config();
const { Client, GatewayIntentBits, Events, MessageFlags, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
const { neon } = require('@neondatabase/serverless');

// 2. Immediate Diagnostic Log
console.log('--- 🛡️ SYSTEM STARTUP 🛡️ ---');
console.log('📍 App URL:', process.env.APP_URL || '❌ MISSING');
console.log('📍 Database:', process.env.DATABASE_URL ? '✅ Connected' : '❌ MISSING');

// DEEP DEBUG: List all keys to find typos
console.log('🔑 Available Env Keys:', Object.keys(process.env).filter(k => !k.includes('TOKEN') && !k.includes('KEY') && !k.includes('URL')).join(', '));
console.log('🔗 URL-related Keys:', Object.keys(process.env).filter(k => k.includes('URL')).join(', '));
console.log('---------------------------');

if (!process.env.DATABASE_URL) {
    console.error("❌ CRITICAL: DATABASE_URL is missing. Bot cannot start.");
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
                    INSERT INTO agents (discord_id, username, is_active)
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
                INSERT INTO agents (discord_id, username, is_active)
                VALUES (${interaction.user.id}, ${interaction.user.username}, true)
                ON CONFLICT (discord_id) 
                DO UPDATE SET username = EXCLUDED.username
                RETURNING id;
            `;

            // 3. CHECK FOR DUPLICATE: Has this user already accepted?
            const [existing] = await sql`
                SELECT id FROM order_participants 
                WHERE order_id = ${parseInt(orderId)} 
                AND agent_id = ${localPublisher.id}
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
                INSERT INTO order_participants (order_id, agent_id)
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

    if (action === 'submit') {
        try {
            // 1. Check if user is enrolled
            const [localPublisher] = await sql`SELECT id FROM agents WHERE discord_id = ${interaction.user.id} LIMIT 1;`;

            if (!localPublisher) {
                return interaction.reply({ content: "❌ You must accept the mission first.", flags: [MessageFlags.Ephemeral] });
            }

            const [enrolled] = await sql`
                SELECT id FROM order_participants 
                WHERE order_id = ${parseInt(orderId)} AND agent_id = ${localPublisher.id} LIMIT 1;
            `;

            if (!enrolled) {
                return interaction.reply({ content: "❌ You are not enrolled in this mission. Click **Accept Mission** first.", flags: [MessageFlags.Ephemeral] });
            }

            // 2. Check Submission Deadline (48h)
            const [order] = await sql`SELECT created_at FROM orders WHERE id = ${parseInt(orderId)} LIMIT 1;`;
            const createdAt = new Date(order.created_at);
            const now = new Date();
            const hoursSinceCreation = (now - createdAt) / (1000 * 60 * 60);

            if (hoursSinceCreation > 48) {
                return interaction.reply({ content: "❌ **Submission Closed.** The 48-hour deadline has passed.", flags: [MessageFlags.Ephemeral] });
            }

            // 3. Check for Duplicate Submission
            const [submitted] = await sql`
                SELECT id FROM submissions 
                WHERE order_id = ${parseInt(orderId)} AND user_id = ${localPublisher.id} LIMIT 1;
            `;

            if (submitted) {
                return interaction.reply({ content: "👋 You have already submitted for this order.", flags: [MessageFlags.Ephemeral] });
            }

            // 4. Show Modal
            const modal = new ModalBuilder()
                .setCustomId(`modal_submit_${orderId}`)
                .setTitle(`Submit Video for Order #${orderId}`);

            const tiktokInput = new TextInputBuilder()
                .setCustomId('tiktok_url')
                .setLabel("TikTok URL")
                .setStyle(TextInputStyle.Short)
                .setPlaceholder("https://www.tiktok.com/@user/video/...")
                .setRequired(true);

            const instagramInput = new TextInputBuilder()
                .setCustomId('instagram_url')
                .setLabel("Instagram Reel URL")
                .setStyle(TextInputStyle.Short)
                .setPlaceholder("https://www.instagram.com/reels/...")
                .setRequired(true);

            const reflectionInput = new TextInputBuilder()
                .setCustomId('reflection')
                .setLabel("Self-Reflection")
                .setStyle(TextInputStyle.Paragraph)
                .setPlaceholder("What did you learn or focus on in this edit?")
                .setRequired(true);

            modal.addComponents(
                new ActionRowBuilder().addComponents(tiktokInput),
                new ActionRowBuilder().addComponents(instagramInput),
                new ActionRowBuilder().addComponents(reflectionInput)
            );

            await interaction.showModal(modal);

        } catch (error) {
            console.error('❌ Failed to trigger submission modal:', error);
            await interaction.reply({ content: '❌ Error opening submission form.', flags: [MessageFlags.Ephemeral] });
        }
    }

    if (action === 'deny') {
        await interaction.reply({ content: '❌ Mission denied. Feel free to ignore.', flags: [MessageFlags.Ephemeral] });
    }
});

// 3. Handle Modal Submissions
client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isModalSubmit()) return;

    if (interaction.customId.startsWith('modal_submit_')) {
        const orderId = interaction.customId.replace('modal_submit_', '');
        const tiktokUrl = interaction.fields.getTextInputValue('tiktok_url').trim();
        const instagramUrl = interaction.fields.getTextInputValue('instagram_url').trim();
        const reflection = interaction.fields.getTextInputValue('reflection');

        // Smart Validation
        const isTikTok = (url) => url.includes('tiktok.com');
        const isInstagram = (url) => url.includes('instagram.com');

        if (!isTikTok(tiktokUrl)) {
            return interaction.reply({ content: "❌ **Invalid TikTok URL.** Please provide a valid link from tiktok.com", flags: [MessageFlags.Ephemeral] });
        }
        if (!isInstagram(instagramUrl)) {
            return interaction.reply({ content: "❌ **Invalid Instagram URL.** Please provide a valid link from instagram.com", flags: [MessageFlags.Ephemeral] });
        }

        try {
            // DEFER REPLY: Buy 15 minutes of time to prevent 3s timeout
            await interaction.deferReply();

            console.log(`📥 Processing dual-link submission for Order #${orderId} by ${interaction.user.username}`);

            const [localPublisher] = await sql`SELECT id FROM agents WHERE discord_id = ${interaction.user.id} LIMIT 1;`;

            // 1. Save to DB
            await sql`
                INSERT INTO submissions (order_id, user_id, tiktok_link, instagram_link, reflection, status)
                VALUES (${parseInt(orderId)}, ${localPublisher.id}, ${tiktokUrl}, ${instagramUrl}, ${reflection}, 'PENDING_REVIEW');
            `;

            // 2. CHECK IF TRACKING SHOULD START (Non-blocking)
            // Logic: If this is the first submission for this order, launch the algorithm
            // We do NOT 'await' this to keep the Discord response snappy
            const startTracking = async () => {
                try {
                    const [orderInfo] = await sql`
                        SELECT is_tracking, scrape_count FROM orders WHERE id = ${parseInt(orderId)} FOR UPDATE;
                    `;

                    if (orderInfo && !orderInfo.is_tracking && orderInfo.scrape_count === 0) {
                        console.log(`🚀 [Bot] First submission detected for Order #${orderId}. Launching Tracking Algorithm...`);

                        if (process.env.APP_URL) {
                            const trackingUrl = `${process.env.APP_URL.replace(/\/$/, '')}/api/track-order`;
                            const response = await fetch(trackingUrl, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ orderId: orderId })
                            });
                            const responseBody = await response.text();
                            console.log(`📡 [Bot] Tracking API Status: ${response.status} - ${responseBody}`);
                        }
                    }
                } catch (err) {
                    console.error('❌ [Bot] Tracking trigger failed:', err.message);
                }
            };

            // Launch tracking in background
            startTracking();

            // 3. Post success to the thread
            await interaction.editReply({
                content: `✅ **Submission Received!**\n\n**Contributor:** <@${interaction.user.id}>\n**TikTok:** ${tiktokUrl}\n**Instagram:** ${instagramUrl}\n**Reflection:** ${reflection}\n\n*Our team will review your edits. Good luck!*`
            });

        } catch (error) {
            console.error('❌ Failed to save submission:', error);
            if (interaction.deferred) {
                await interaction.editReply({ content: '❌ Error saving your submission. Please try again.' });
            } else {
                await interaction.reply({ content: '❌ Error saving your submission. Please try again.', flags: [MessageFlags.Ephemeral] });
            }
        }
    }
});

client.on('error', (error) => {
    console.error('❌ Discord Client Error:', error);
});

client.login(process.env.DISCORD_TOKEN);
