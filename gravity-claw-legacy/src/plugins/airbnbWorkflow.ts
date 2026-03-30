import { scrapeListing, AirbnbListing } from './airbnbScraper.js';
import { retouchImage, TIER_CONFIG, TierName } from './vertexRetoucher.js';
import { scoreAndFeedback, TIER_THRESHOLDS } from './ieoScorer.js';
import fs from 'fs';
import path from 'path';

const STORAGE_DIR = path.resolve(process.cwd(), 'dist/web/public/storage');
const MAX_RETOUCH_ROUNDS = 3;

if (!fs.existsSync(STORAGE_DIR)) {
  fs.mkdirSync(STORAGE_DIR, { recursive: true });
}

export interface WorkflowUpdate {
  agentId: string;
  targetAgentId?: string;
  status: string;
  log?: string[];
  photoUrl?: string;
  assetLabel?: string;
  outputs?: any[];
}

/**
 * Airbnb Enhancement Workflow — REAL PIPELINE
 *
 * Stages:
 *  1. ZARA  (Data Analyst): Scrape listing via Apify → listing data + photos
 *  2. PRIYA (SIO Scorer):   Score RAW photo → baseline score
 *  3. JIN   (Retoucher):    Vertex AI retouch → enhanced photo
 *  4. PRIYA (SIO Scorer):   Score RETOUCHED photo → pass/fail
 *     ↳ If fail: feedback → JIN re-retouches (up to 3 rounds)
 *     ↳ If pass: → ALEX packages result
 *  5. ALEX  (Studio Mgr):   Package before/after + scorecard → Client
 */
export async function runAirbnbWorkflow(
  url: string,
  tier: TierName = 'pro',
  onUpdate: (update: WorkflowUpdate) => void
) {
  const threshold = TIER_THRESHOLDS[tier] || 80;
  const tierConfig = TIER_CONFIG[tier];

  try {
    // ═══════════════════════════════════════════
    // STAGE 1: ZARA — Scrape listing
    // ═══════════════════════════════════════════
    onUpdate({ 
      agentId: 'data-analyst', 
      status: 'working', 
      log: [
        `Reading Alex's brief: pilot 1-photo scrape for ${tierConfig.label} tier…`,
        'Connecting Apify residential proxy cluster…'
      ] 
    });

    const listing = await scrapeListing(url, (msg: string) => {
      onUpdate({ agentId: 'data-analyst', status: 'working', log: [msg] });
    }) as AirbnbListing;

    if (!listing.photos || listing.photos.length === 0) throw new Error('No photos found in listing');

    // Download hero photo locally
    const heroPhotoUrl = listing.photos[0].url;
    const localHeroName = `raw_hero_${Date.now()}.jpg`;
    const localHeroPath = path.join(STORAGE_DIR, localHeroName);
    
    const imgResp = await fetch(heroPhotoUrl);
    if (!imgResp.ok) throw new Error(`Failed to download hero photo: ${imgResp.status}`);
    const imgBuffer = Buffer.from(await imgResp.arrayBuffer());
    fs.writeFileSync(localHeroPath, imgBuffer);
    const publicHeroUrl = `/storage/${localHeroName}`;

    onUpdate({ 
      agentId: 'data-analyst', 
      status: 'done', 
      log: [`Scraped "${listing.title}"`, `${listing.photos.length} photos found`, `Hero downloaded ✓`],
      photoUrl: publicHeroUrl,
      assetLabel: 'Raw Pilot Shot',
      outputs: [
        { type: 'doc', label: 'scrape-report.md', preview: `# Scrape: ${listing.title}\n\n- Price: ${listing.pricePerNight} ${listing.currency}\n- Rating: ${listing.rating} (${listing.reviewCount} reviews)\n- Host: ${listing.hostName}\n- Photos: ${listing.photos.length}\n- Proxy: Apify Residential` }
      ]
    });

    // ═══════════════════════════════════════════
    // STAGE 2: PRIYA — Score RAW photo (baseline)
    // ═══════════════════════════════════════════
    onUpdate({ 
      agentId: 'data-analyst', 
      targetAgentId: 'ieo-scorer', 
      status: 'working', 
      log: ['Passing raw photo to Priya for baseline SIO audit ➜'] 
    });

    onUpdate({ 
      agentId: 'ieo-scorer', 
      status: 'working', 
      log: [`Scoring raw photo against ${tierConfig.label} tier (target: ${threshold}+)…`] 
    });

    const baselineScore = await scoreAndFeedback(
      localHeroPath, tier, 'Initial raw Airbnb photo from host.',
      (msg) => onUpdate({ agentId: 'ieo-scorer', status: 'working', log: [msg] })
    );

    onUpdate({ 
      agentId: 'ieo-scorer', 
      status: 'done', 
      log: [
        `Baseline SIO: ${baselineScore.score}/100`,
        `Target: ${threshold}+ (${tierConfig.label})`,
        baselineScore.passed ? 'Raw photo PASSES — no retouch needed!' : `Below threshold. Feedback for Jin: ${baselineScore.feedback.length} items.`
      ], 
      assetLabel: 'Baseline SIO Report',
      outputs: [
        { type: 'doc', label: 'baseline-scores.md', preview: baselineScore.dimensions.map(d => `${d.name}: ${d.score}/${d.maxScore}`).join('\n') }
      ]
    });

    // If raw photo already passes, skip retouching
    let finalImagePath = localHeroPath;
    let finalImageUrl = publicHeroUrl;
    let finalScore = baselineScore;
    let retouchRounds = 0;

    if (!baselineScore.passed) {
      // ═══════════════════════════════════════════
      // STAGE 3+4: JIN ↔ PRIYA — Retouch + Score Loop
      // ═══════════════════════════════════════════
      let currentFeedback = baselineScore.feedback.join('. ');
      let currentImagePath = localHeroPath;

      for (let round = 1; round <= MAX_RETOUCH_ROUNDS; round++) {
        retouchRounds = round;

        // JIN retouches
        onUpdate({
          agentId: 'ieo-scorer',
          targetAgentId: 'retoucher',
          status: 'working',
          log: [`Sending to Jin for ${tierConfig.label}-tier retouch (round ${round}/${MAX_RETOUCH_ROUNDS}) ➜`]
        });

        onUpdate({ 
          agentId: 'retoucher', 
          status: 'working', 
          log: [
            `Vertex AI: ${tierConfig.label}-tier retouch round ${round}…`,
            round > 1 ? `Addressing SIO feedback: ${currentFeedback.substring(0, 80)}…` : 'Applying full editing pipeline…'
          ] 
        });

        const retouchResult = await retouchImage({
          imagePath: currentImagePath,
          tier,
          feedback: round > 1 ? currentFeedback : undefined,
          round,
        }, (msg) => onUpdate({ agentId: 'retoucher', status: 'working', log: [msg] }));

        if (retouchResult.success && retouchResult.retouchedImagePath) {
          currentImagePath = retouchResult.retouchedImagePath;
          finalImagePath = retouchResult.retouchedImagePath;
          if (retouchResult.retouchedImageUrl) {
            finalImageUrl = retouchResult.retouchedImageUrl;
          }
        }

        onUpdate({ 
          agentId: 'retoucher', 
          status: 'done', 
          log: [
            `${tierConfig.label}-tier retouch round ${round} complete ✓`,
            retouchResult.editPlan?.substring(0, 100) || 'Corrections applied.',
            `Self-assessment: ${retouchResult.selfScore}/100`
          ],
          photoUrl: finalImageUrl,
          assetLabel: `Retouched (Round ${round})`
        });

        // PRIYA re-scores
        onUpdate({
          agentId: 'retoucher',
          targetAgentId: 'ieo-scorer',
          status: 'working',
          log: [`Passing retouched image back to Priya for re-score ➜`]
        });

        onUpdate({ 
          agentId: 'ieo-scorer', 
          status: 'working', 
          log: [`Re-scoring retouched image (round ${round})…`] 
        });

        const roundScore = await scoreAndFeedback(
          currentImagePath, tier, `Post-retouch round ${round}.`,
          (msg) => onUpdate({ agentId: 'ieo-scorer', status: 'working', log: [msg] })
        );

        finalScore = roundScore;

        onUpdate({ 
          agentId: 'ieo-scorer', 
          status: roundScore.passed ? 'done' : 'working', 
          log: [
            `Round ${round} SIO: ${roundScore.score}/100 (target: ${threshold}+)`,
            roundScore.passed 
              ? `✓ PASS — ${tierConfig.label} tier achieved!` 
              : `✗ Below threshold. ${MAX_RETOUCH_ROUNDS - round} rounds remaining.`
          ]
        });

        if (roundScore.passed) {
          break; // Exit the loop — we've hit the target
        }

        // Update feedback for next round
        currentFeedback = roundScore.feedback.join('. ');
      }
    }

    // ═══════════════════════════════════════════
    // STAGE 5: ALEX — Package + Report to Client
    // ═══════════════════════════════════════════
    onUpdate({ 
      agentId: 'ieo-scorer', 
      targetAgentId: 'sm', 
      status: 'working', 
      log: ['Pilot complete. Packaging results for Studio Manager ➜'] 
    });

    const delta = finalScore.score - baselineScore.score;

    onUpdate({
      agentId: 'sm',
      status: 'done',
      log: [
        'Pilot results received ✓',
        `SIO: ${baselineScore.score} → ${finalScore.score} (+${delta})`,
        `Tier: ${tierConfig.label} ${finalScore.passed ? '✓ ACHIEVED' : '⚠ Best effort'}`,
        `Retouch rounds: ${retouchRounds}`,
        'Broadcasting to Lucy the Client.'
      ],
      outputs: [
        { 
          type: 'doc', 
          label: 'pilot-summary.md', 
          preview: `# Pilot Execution Summary\n\n**Property**: ${listing.title}\n**Tier**: ${tierConfig.label} ($${tierConfig.price})\n\n**Zara**: Scraped pilot image ✓\n**Priya**: Baseline SIO ${baselineScore.score}/100\n**Jin**: ${retouchRounds} retouch round(s) via Vertex AI\n**Priya**: Final SIO ${finalScore.score}/100 (+${delta})\n\n**Verdict**: ${finalScore.passed ? 'Ready for full roll-out.' : 'Best-effort within budget limits.'}` 
        }
      ]
    });

    // Broadcast project complete
    try {
      const { WebChannel } = await import('./web-channel.js');
      WebChannel.getInstance().broadcast(JSON.stringify({ type: 'project_complete' }));
    } catch(e) { /* WebChannel may not be initialized in all contexts */ }

    return { listing, enhancedUrl: finalImageUrl, baselineScore: baselineScore.score, finalScore: finalScore.score, tier };

  } catch (err: any) {
    onUpdate({ agentId: 'sm', status: 'error', log: [`Workflow failed: ${err.message}`] });
    throw err;
  }
}
