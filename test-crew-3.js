require('dotenv').config();

const crewApiUrl = "https://anthropos-order-8181b89e-a66c-4019-9ae3-472-bdb8118f.crewai.com/kickoff";
const CREW_AI_TOKEN = process.env.CREW_AI_TOKEN;

async function test() {
    const res = await fetch(crewApiUrl, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${CREW_AI_TOKEN}`
        },
        body: JSON.stringify({
            inputs: {
                amazon_url: 'https://amazon.com',
                product_image_url: 'https://test.com',
                expert_input: 'testing input',
                persona_name: 'test',
                persona_description: 'test description'
            },
            crewWebhookUrl: 'http://localhost:3000/api/webhooks/crewai'
        })
    });
    console.log("Status:", res.status);
    console.log("Text:", await res.text());
}

test();
