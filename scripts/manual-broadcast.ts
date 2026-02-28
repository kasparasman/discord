import 'dotenv/config';
import { prisma } from '../src/lib/prisma';
import { broadcastOrderToDiscord } from '../src/lib/services/orderService';


async function main() {
    // 1. Find the last incomplete order (or create a temporary one if none exists)
    const order = await prisma.order.findFirst({
        where: {
            OR: [
                { status: 'PENDING_CREWAI' },
                { briefContent: null }
            ]
        },
        orderBy: { id: 'desc' }
    });

    if (!order) {
        console.error('No pending order found. Please check your DB.');
        return;
    }

    const orderId = order.id;
    const briefContent = `## SECTION 1 — OBJECTIVE LOCK 
This video sells Nordic Naturals Omega-3 to mentally fatigued Americans by breaking the belief that they can function optimally on a standard diet using the reason that the brain is a high-performance engine made of 60% fat which requires concentrated EPA/DHA premium fuel to eliminate cognitive sludge and unlock 100% performance.

## SECTION 2 — AVATAR SPEC (broad market)
**Avatar Label:** 
The "Running on Fumes" Everyday Adult

**Symptom Cluster (Extracted Language):**
*   "I feel like I'm walking through wet cement by 2 PM."
*   "Can't hold a train of thought for more than five minutes."
*   "Waking up already feeling mentally exhausted."
*   "Forgetting simple words right in the middle of a sentence."
*   "Just scrolling because my brain is too tired to actually engage."

**Desired Outcome:**
To experience sharp, sustained mental clarity without relying on a fourth cup of coffee to force productivity.
*   "I just want to feel like my brain is actually turned on again."
*   "Being able to focus on a single task at work until it's finished."
*   "Having the mental energy to be present with my kids after 5 PM."

**Most Common Objection:**
Premium supplements are overpriced snake oil that just cause gastrointestinal distress without delivering noticeable cognitive benefits.
*   "I tried fish oil before and just got gross, rancid fish burps all day."
*   "Are these actually doing anything, or just giving me expensive pee?"
*   "I can just eat tuna or salmon instead of paying $45 for a bottle of pills."

**Trust Heuristic:**
Third-party purity testing (IFOS certification) and bioavailable triglyceride form. (Extracted signal: "No fishy aftertaste means it's not oxidized," "Must show heavy metal testing," "Needs high EPA/DHA ratios, not just total fish oil amount.")

## SECTION 3 — MARKET LANGUAGE BANKS (symptom / objection / trust)
**Language Bank: Symptoms**
Brain fog, mental fatigue, sluggishness, afternoon crash, memory slips, scattered focus, cognitive sludge, exhaustion, burnout, heavy head, drained, running on empty, forgetful, spacey, cloudy mind, unmotivated, autopilot, dragging, overwhelmed, distracted. 

**Language Bank: Objections**
Fish burps, rancid smell, horse pills, overpriced, snake oil, hard to swallow, upset stomach, expensive pee, fake reviews, hype.

**Language Bank: Trust / Heuristic**
Lemon flavor, no aftertaste, triglyceride form, third-party tested, wild-caught, high EPA/DHA, heavy metal free, doctor recommended, IFOS certified, pure.

**Top 5 Phrases (Normalized Recurrence):**
1. "Finally, a fish oil with zero fish burps."
2. "My afternoon brain fog completely lifted."
3. "They are huge but surprisingly easy to swallow."
4. "Expensive, but you get what you pay for."
5. "The lemon scent completely hides the fishy smell."

## SECTION 4 — PRODUCT TRUTH ANCHORS (facts + review proof + claim flags)
**1. PRODUCT FACT ANCHORS (The Undeniable Specs)**
*   **Active Ingredients:** Concentrated EPA and DHA (Omega-3 fatty acids).
*   **Bioavailability:** Delivered in the natural Triglyceride form (ensures optimal absorption compared to synthetic ethyl esters).
*   **Sourcing:** 100% wild-caught, sustainably sourced fish (typically anchovies and sardines).
*   **Sensory:** Infused with natural lemon flavor to neutralize odor and taste.
*   **Certifications & Testing:** Third-party purity tested (tested for heavy metals, toxins, and PCBs), Friend of the Sea Certified, Non-GMO Verified.

**2. REVIEW-PROOF PROOF POINTS (Aggregated Market Reality)**
*   **The "Burpless" Reality:** The most prevalent physical proof point. The lemon flavor and high-purity/low-oxidation oil completely eliminate the "rancid fish burp" objection that plagues cheaper alternatives.
*   **The Size-to-Swallow Ratio:** The pills are objectively large ("horse pills"), but the specific softgel casing makes them glide down easily, contradicting the initial visual objection.
*   **The "Afternoon Lift" Effect:** Users consistently anchor their success to surviving the 2 PM crash. The proof isn't waking up a genius; it's the absence of the mid-day "wet cement" brain feeling.
*   **The Premium Justification:** Users openly admit it is expensive, but justify the price point strictly through the absence of side effects (no upset stomach) and visible cognitive stamina. 

**3. CLAIM COMPLIANCE FLAGS (Allowed vs. Risky)**
*   **GREEN FLAGS (Allowed & Supported by Facts):** "Supports optimal brain health and cognitive function." / "Promotes mental clarity and focus." / "Provides essential fatty acids your brain needs to perform." / "Third-party tested to guarantee purity from heavy metals and environmental toxins." / "Absorbs better than standard fish oils due to the triglyceride form."
*   **RED FLAGS (Risky/Prohibited by FDA/FTC):** *Do NOT claim:* "Cures brain fog" or "Eliminates cognitive decline." (Use "lifts," "clears," or "supports"). / *Do NOT claim:* "Treats ADHD, depression, anxiety, or Alzheimer's." / *Do NOT claim:* "Replaces your ADHD medication or prescription stimulants." / *Do NOT claim:* "Instantly fixes memory loss."

## SECTION 5 — SINGLE REASON TO WIN (belief break + mechanism)
**The Cognitive Stamina Angle**

*   **The Claim:** Premium cognitive stamina that clears the mid-day "wet cement," delivered without the rancid aftershocks.
*   **The Mechanism:** Your brain naturally depletes its resources throughout the day, leading to the dreaded 2 PM "wet cement" crash where focus evaporates. By providing a highly bioavailable (Triglyceride) dose of pure EPA/DHA infused with natural lemon, we physically nourish your cognitive reserves—giving you smooth, sustained mental clarity without the rancid fish burps that ruin cheap alternatives.
*   **The Belief Break (Lever):** Shifting the consumer from *“I need caffeine to survive the afternoon”* to *“I need bioavailable Omega-3 to structurally prevent the afternoon crash.”*
*   **The Proof Anchors:** 
    *   *Triglyceride Bioavailability* (The scientific reason it works).
    *   *The "Afternoon Lift" Review Reality* (The social proof that it works).
    *   *The "Burpless" Lemon Infusion* (The physical proof of premium purity that justifies the price point).

## SECTION 6 — SCRIPT PACK (6 hooks + master body + close CTA)

*(Note: Prescriptive shot-lists have been filtered out. Publishers retain full autonomy over shot execution, provided the Strategic Visual Intent, strict timeboxes, and on-screen text requirements are met.)*

**GATE 1: THE HOOKS (0-6 Seconds)**
*Objective: High-density pattern interrupts using exact market language to establish the symptom, the objection, or the SRW immediately. Product MUST enter frame by 0:02.*

**Hook 1 (The Exact Phrase Strike)**
*   **Audio:** "Searching for a premium brain fuel without gastric rebellion? I am your structural upgrade."
*   **On-Screen Text:** Clear The Afternoon Brain Fog
*   **Strategic Visual Intent:** Establish severe mental fatigue instantly, seamlessly introducing the product into the frame by the 2-second mark to frame it as the ultimate solution.

**Hook 2 (The SRW / Symptom Agitator)**
*   **Audio:** "If your neural pathways feel like wet cement at 2 PM, stop pouring superficial caffeine over the sludge."
*   **On-Screen Text:** Brain Like Wet Cement?
*   **Strategic Visual Intent:** Agitate the specific "mid-day crash" symptom visually, transitioning sharply to the product as the structural fix for cognitive sludge.

**Hook 3 (The Objection Inversion)**
*   **Audio:** "My capsules possess significant volume, but superior biological architecture cannot be manufactured cheaply."
*   **On-Screen Text:** Yes, They Are Large.
*   **Strategic Visual Intent:** Address the "horse pill" size objection boldly and upfront, reframing the size as a hallmark of premium biological necessity rather than a flaw.

**Hook 4 (The Autopilot Interrupt)**
*   **Audio:** "Tired of surviving the afternoon crash on autopilot? This is how you build actual, sustained cognitive stamina."
*   **On-Screen Text:** Stop Running On Autopilot
*   **Strategic Visual Intent:** Contrast the exhausted, spaced-out "autopilot" state with the immediate introduction of the premium cognitive fuel. 

**Hook 5 (The Mechanism Tease)**
*   **Audio:** "Stop wasting money on cheap, synthetic fish oil that just gives you rancid burps and zero mental clarity."
*   **On-Screen Text:** Stop The Fish Burps
*   **Strategic Visual Intent:** Highlight the visceral pain of cheap alternatives (gastric distress/burps) and immediately pivot to the premium upgrade.

**Hook 6 (The Sensory / Trust Anchor)**
*   **Audio:** "The natural lemon scent completely hides the fishy smell, but what it does for your mental fatigue is incredible."
*   **On-Screen Text:** Zero Fishy Smell. 100% Clarity.
*   **Strategic Visual Intent:** Anchor trust through sensory cues (lemon infusion/lack of smell) while promising the desired cognitive stamina outcome.

**GATE 2: THE MASTER BODY (6-20 Seconds)**
*Objective: Install the new belief within the 14-second timebox. Shift the hero from masking the crash to structurally preventing it using the Triglyceride bioavailability mechanism.*

*   **Audio:** "Cheap, synthetic oils pass right through you. I deliver bioavailable Triglyceride EPA and DHA. I actually absorb, reconstructing your cognitive reserves for sustained mental stamina—with zero rancid fish burps."
*   **On-Screen Text:** Absorbs Faster + Zero Fish Burps
*   **Strategic Visual Intent:** Visually demonstrate the product's purity and the ease of consumption. The imagery should reinforce premium quality and frictionless daily use, definitively contradicting taste and size objections without dictating exact camera angles.

**GATE 3: THE CLOSE CTA (20-30 Seconds)**
*Objective: Justify the premium price point as an investment in daily performance, anchor trust, and drive the click within the final 10 seconds.*

*   **Audio:** "I am a calculated investment in your daily performance. Cease dragging your failing hardware through the afternoon. Click the link to secure your structural upgrade."
*   **On-Screen Text:** Secure Your Structural Upgrade ⬇️
*   **Strategic Visual Intent:** Direct, high-energy, authoritative call to action. The creator must break the fourth wall, focusing entirely on driving the viewer's attention to the link with absolute conviction.`;

    console.log(`Manual broadcast for Order #${orderId}`);

    // Update the DB first
    await prisma.order.update({
        where: { id: orderId },
        data: {
            briefContent: briefContent,
            status: 'OPEN'
        }
    });

    // Run the broadcast
    await broadcastOrderToDiscord({
        orderId: orderId,
        briefContent: briefContent,
        productLink: order.productLink || '',
        rawInput: order.rawInput
    });

    console.log('Broadcast complete!');
}

main().catch(console.error).finally(() => prisma.$disconnect());
