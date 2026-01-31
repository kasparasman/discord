const { ApifyClient } = require('apify-client');
require('dotenv').config();

// USAGE: node test-apify.js
async function runTest() {
    const client = new ApifyClient({
        token: process.env.APIFY_TOKEN,
    });

    const testUrls = [
        "https://www.tiktok.com/@mrbeast/video/7463690615555460382",
        "https://www.instagram.com/reels/C2f9Zf8s8f8/"
    ];


    console.log('🚀 Starting Stress Test on Apify Actors...');

    // 1. TikTok Test (GdWCkxBtKWOsKjdch)
    console.log('\n--- 🎵 TikTok Actor Test ---');
    try {
        const ttRun = await client.actor("GdWCkxBtKWOsKjdch").call({
            postURLs: [testUrls[0]],
            resultsPerPage: 1,
            profileScrapeSections: ["videos"],
            shouldDownloadVideos: false,
        });

        const { items: ttItems } = await client.dataset(ttRun.defaultDatasetId).listItems();
        if (ttItems.length > 0) {
            const item = ttItems[0];
            console.log('✅ TikTok Data Received');
            console.log('📍 item.input value:', item.input);
            console.log('📍 playCount:', item.playCount);
            console.log('📍 diggCount:', item.diggCount);
            console.log('📍 shareCount:', item.shareCount);
            console.log('📍 commentCount:', item.commentCount);
            console.log('📍 Keys available:', Object.keys(item).join(', '));
        } else {
            console.log('❌ TikTok: No data returned.');
        }
    } catch (e) {
        console.error('❌ TikTok Test Failed:', e.message);
    }

    // 2. Instagram Test (shu8hvrXbJbY3Eb9W)
    console.log('\n--- 📸 Instagram Actor Test ---');
    try {
        const igRun = await client.actor("shu8hvrXbJbY3Eb9W").call({
            "hashtags": ["fitness"],
            "resultsType": "posts",
            "resultsLimit": 1,
            "searchType": "hashtag",
            "searchLimit": 1,
            "addParentData": false
        });


        const { items: igItems } = await client.dataset(igRun.defaultDatasetId).listItems();
        if (igItems.length > 0) {
            const item = igItems[0];
            console.log('✅ Instagram Data Received');
            console.log('📍 item.input value:', item.input);
            console.log('📍 videoPlayCount:', item.videoPlayCount);
            console.log('📍 likesCount:', item.likesCount);
            console.log('📍 commentsCount:', item.commentsCount);
            console.log('📍 Keys available:', Object.keys(item).join(', '));
        } else {
            console.log('❌ Instagram: No data returned.');
        }


    } catch (e) {
        console.error('❌ Instagram Test Failed:', e.message);
    }

    console.log('\n--- 🛑 Test Complete ---');
}

runTest();
