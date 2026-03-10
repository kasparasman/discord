import dotenv from 'dotenv';
dotenv.config();

const crewApiUrl = "https://anthropos-order-8181b89e-a66c-4019-9ae3-472-bdb8118f.crewai.com/kickoff";
const CREW_AI_TOKEN = process.env.CREW_AI_TOKEN;

async function test() {
    console.log("Token:", CREW_AI_TOKEN?.slice(0, 5) + "...");
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
                persona_name: 'The Mascot',
                persona_description: 'A mascot'
            },
            crewWebhookUrl: 'http://test.com'
        })
    });
    console.log("Status:", res.status);
    console.log("Text:", await res.text());
}

test();
