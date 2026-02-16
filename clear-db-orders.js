const fs = require('fs');
const path = require('path');

// Load ENVs
if (fs.existsSync(path.join(__dirname, '.env.local'))) {
    require('dotenv').config({ path: '.env.local' });
} else {
    require('dotenv').config();
}

const { neon } = require('@neondatabase/serverless');

if (!process.env.DATABASE_URL) {
    console.error("❌ CRITICAL: DATABASE_URL is missing.");
    process.exit(1);
}

const sql = neon(process.env.DATABASE_URL);

async function clearTestData() {
    console.log('🧹 Starting Database Cleanup (Orders, Participants, Submissions)...');

    try {
        // Order matters due to foreign keys
        console.log('🗑️ Clearing submissions...');
        await sql`DELETE FROM submissions;`;

        console.log('🗑️ Clearing order participants...');
        await sql`DELETE FROM order_participants;`;

        console.log('🗑️ Clearing orders...');
        await sql`DELETE FROM orders;`;

        console.log('✅ Database cleanup successful.');
    } catch (error) {
        console.error('❌ Database cleanup failed:', error);
    }
}

clearTestData();
