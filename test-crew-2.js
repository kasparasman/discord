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
                expert_input: `The video is a ~20-second heuristic pilot for Thorne Daily Electrolytes. The core visual metaphor contrasts "Flushing the Battery" (hydration without minerals) vs. "Recharging the Battery" (mineralized hydration).\n\nThe narrative begins in a dark, fleshy, abstract biological energy chamber (Scene 1: Fatigue/Dilution). The anthropomorphized Thorne packet mascot stands next to a massive cylindrical bio-battery. The battery's neon-cyan fluid is draining and the chamber is dimming as the mascot explains how stress and plain water kill energy. An extreme negative state is reached when a flood of clear water totally short-circuits the battery, plunging the room into darkness.\n\nThe middle sequence (The Bridge) features a hyper-bright neon-cyan powder being poured into a clear glass in pitch darkness, instantly dissolving and illuminating the scene.\n\nThe climax (The Solution) instantly switches to brilliant, perfectly exposed clinical lighting. The mascot drinks the glowing liquid, triggering a blinding flash from the giant battery which surges from 0% to 100% neon-cyan capacity. The camera dramatically tilts up to reveal the fully recharged, towering battery, banishing all shadows.\n\nThe final sequence (CTA) uses an extremely fast cinematic zoom-out and fluid morph transition, transforming the bio-chamber into the high-tech, glowing Anthropos Grow Shop, where the mascot points to the product on a display stand.\n\nThe overall aesthetic is ultra-high detail, photorealistic premium 3D anatomical rendering. Lighting shifts aggressively from moody/high-contrast/dark in the problem state to explosive, zero-shadow neon-cyan in the solution state.\n`,
                persona_name: `The Thorne Electrolyte Mascot`,
                persona_description: `A highly detailed, photorealistic anthropomorphized Thorne Daily Electrolytes stick-pack mascot. His main body is a flat, rectangular foil packet featuring distinct Thorne branding and clean typography. He possesses expressive facial features integrated seamlessly into the packet design, along with distinct, functional arms. He moves and acts with deliberate, serious, and controlled authority—like a high-end biochemical engineer or an elite medic. He is not a cartoon; he is a hyper-realistic, premium supplement come to life. Throughout the video, his physical geometry (the rectangular stick pack) remains aggressively consistent and never morphs. He carries himself with a confident, problem-solving posture, maintaining perfect eye contact with the viewer when explaining physiological facts.\n`
            },
            crewWebhookUrl: 'http://test.com'
        })
    });
    console.log("Status:", res.status);
    console.log("Text:", await res.text());
}

test();
