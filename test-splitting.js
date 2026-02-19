
const text = `## SECTION 1 — OBJECTIVE LOCK

This video sells Nordic Omega-3 to 20–40 year olds by breaking the belief that their fatigue and brain fog are inevitable symptoms of stress or aging using the reason that these are structural biological failures caused by cellular membrane degradation that only Omega-3 can repair.

## SECTION 2 — AVATAR SPEC (Broad Market)

**Target: The Fading High-Performer**

*   **Symptom Cluster:** Hitting a wall at 2 PM; forgetting common words mid-sentence; waking up unrefreshed; "brain buffering" or mental static making simple tasks feel heavy.
*   **Desired Outcome:** Regaining effortless mental sharpness and sustained energy; waking up refreshed; "plugging back in" to high-level cognitive function.
*   **Most Common Objection:** Deep skepticism born from trying ineffective vitamins; fear of "fishy burps"; belief that burnout is permanent or age-related.
*   **Trust Heuristic:** Third-party purity tested (IFOS 5-Star Rating) and a total lack of "fishy" smell/taste.

## SECTION 3 — MARKET LANGUAGE BANKS

*   **Symptoms:** Brain fog, afternoon slump, mental fatigue, forgetting words, zoning out, sluggish, cloudy head, dragging, mentally drained, fuzzy brain, lagging, slow processing, brain feels like mush, mental static.
*   **Objections:** Fishy burps, gross aftertaste, rancid oil, mercury concerns, heavy metals, huge pills, expensive pee, just marketing hype, oxidized oil.
*   **Trust/Heuristics:** Third-party tested, IFOS certified, lemon flavor, triglyceride form, pharmaceutical grade, molecularly distilled, certificate of analysis (COA), wild-caught.
*   **Top 5 Phrases:** 
    1. "Finally cleared the brain fog."
    2. "No fishy burps or aftertaste."
    3. "Actually feel the difference."
    4. "Worth the extra money."
    5. "Mental sharpness is back."

## SECTION 4 — PRODUCT TRUTH ANCHORS

*   **Fact: The Triglyceride Advantage:** Uses the natural Triglyceride form (not synthetic Ethyl Ester), resulting in 70% better absorption.
*   **Fact: Batch Transparency:** Every bottle has a QR code linking to a batch-specific Certificate of Analysis (COA) proving purity from heavy metals.
*   **Fact: Freshness Standard:** Molecularly distilled and processed without heat/chemicals to prevent oxidation (the cause of fishy burps).
*   **Review Proof:** Analysis shows "No Fishy Aftertaste" is the #1 benefit; users report the "Mental Lift" consistently between days 14 and 21.
*   **Claim Risk Flag:** DO NOT claim to "cure" chronic fatigue; DO claim it "supports cognitive health" and "provides cellular building blocks."

## SECTION 5 — SINGLE REASON TO WIN (SRW)

**The Lever: Bio-Identical Cellular Restoration**

*   **Belief Break:** Energy isn't something you "kickstart" with caffeine; it’s a byproduct of cellular integrity. If your cell membranes are made of cheap, synthetic fats (or are deficient), you will feel sluggish regardless of stimulant intake.
*   **Mechanism:** Most Omega-3s are synthetic chemicals the body treats as waste. Nordic Naturals provides the bio-identical Triglyceride form that integrates directly into cell membranes, "re-oiling" the machinery of the brain to restore energy transport at the structural level.

## SECTION 6 — SCRIPT PACK (POST-AUDIT OPTIMIZED)

**Part 1: The Hooks (0-6s)**
*   **Hook 1:** (Visual: Bottle held center-frame. OST: 2 PM BRAIN FOG?) "I’ve seen you staring at your screen since 2 PM. It’s not a lack of caffeine. Your cell membranes are literally starving."
*   **Hook 2:** (Visual: Bottle vs. Drugstore bottle. OST: SYNTHETIC VS. BIO-IDENTICAL) "Most supplements are synthetic 'Ethyl Esters' your body treats like waste. I’m built differently."
*   **Hook 3:** (Visual: Focus on 14-21 day timeline on label. OST: THE 21-DAY BRAIN LIFT) "Give me 21 days to rebuild your cell walls. If you haven’t felt the 'lift' yet, you’re using the wrong bottle."
*   **Hook 4:** (Visual: User smelling bottle; Lemon graphic. OST: ZERO FISHY AFTERTASTE) "Smell your fish oil. If it smells like a pier, it’s oxidized and causing more fog. I taste like fresh lemon."
*   **Hook 5:** (Visual: Label rotation to Triglyceride. OST: 70% BETTER ABSORPTION) "Your cells are looking for the triglyceride form. I absorb 70% better because your body actually recognizes me."
*   **Hook 6:** (Visual: Bottle on clean pedestal. OST: REBUILD CELLULAR ENERGY) "You don’t need a ‘limitless’ pill. You need the cellular building blocks you’re missing. I’m the architecture."

**Part 2: The Master Body (6-20s)**
*   **Visual:** Split screen: Rigid vs. Fluid cell membrane animation.
*   **Audio:** "Mental fatigue is a sign your cell membranes are structurally compromised. Most drugstore brands use synthetic 'Ethyl Ester' fats that your body struggles to process. Nordic Naturals delivers the natural Triglyceride form. This is Bio-Identical Cellular Restoration—sliding directly into your cell walls to re-oil the machinery and restore energy transport at the source."
*   **OST:** BIO-IDENTICAL RESTORATION | RE-OIL THE MACHINERY

**Part 3: The Close (20-30s)**
*   **Visual:** User scanning the bottle QR code. Transition to Shop Now button.
*   **Audio:** "We are third-party purity tested with zero heavy metals and zero fishy aftertaste. If you’re ready to actually feel the difference in your focus, the triglyceride advantage is ready for you. Click the link below to clear the fog and shop Nordic Naturals."
*   **OST:** IFOS 5-STAR CERTIFIED | CLICK TO SHOP: NORDIC NATURALS

## SECTION 7 — PHYSICS AUDIT

*   **Status:** PASS
*   **Requirements:** Product visibility is locked at 0:01-0:02 across all hooks. OST is mandatory for all segments to maintain engagement in "sound-off" environments. The SRW (Triglyceride/Cellular Restoration) is the mandatory bridge between the symptom and the product. Non-linear modularity is maintained.

## SECTION 8 — PUBLISHER AUTONOMY ZONE

**EXPLICIT DECLARATION:** The strategic intent, Objective Lock, and Single Reason to Win (Bio-Identical Cellular Restoration) defined in this brief are fixed requirements. However, the Publisher/Creator retains full autonomy over the creative execution, including specific visual metaphors, creator persona choice, and editing style, provided the core "Market-Backward" logic and Product Truths remain intact. This brief is a strategic map, not a creative cage.
`;

function testSplitting(text) {
    const isDossier = /ANTHROPOS|DOSSIER|NETWORK|PROTOCOL|FIELD MANUAL|SECTION/i.test(text) || (text.match(/^#{2} /m) || []).length > 1;
    console.log("Is Dossier:", isDossier);

    if (!isDossier) {
        console.log("Not recognized as dossier. Falling back to single embed.");
        console.log("Truncated Content Length:", text.slice(0, 4000).length);
        return;
    }

    let sections = text.split(/(?=^#{2} )/gm);
    console.log("Sections count:", sections.length);

    sections.forEach((rawSection, idx) => {
        const content = rawSection.trim();
        if (!content) return;

        let title = "";
        let body = content;

        const headerMatch = content.match(/^(?:#{2,3})\s*([^\n]+)/m);
        if (headerMatch) {
            title = headerMatch[1].trim();
            body = content.replace(headerMatch[0], "").trim();
        }

        if (idx === 0) {
            console.log(`Embed ${idx} Title: Dossier Header`);
            console.log(`Embed ${idx} Body Length:`, body.slice(0, 4000).length);
        } else {
            console.log(`Embed ${idx} Title:`, title);
            console.log(`Embed ${idx} Body Length:`, body.slice(0, 4000).length);
        }
    });
}

testSplitting(text);
