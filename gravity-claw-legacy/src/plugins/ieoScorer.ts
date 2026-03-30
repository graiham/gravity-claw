/**
 * IEO Scorer — Image Engine Optimisation
 * Scores property photos 0–100 and recommends retouching operations.
 * Works in tandem with the Photo Retoucher (Topaz / Autoenhance).
 *
 * Scoring dimensions:
 *  - Lighting quality & warmth         (20pts)
 *  - Staging & furniture arrangement   (20pts)
 *  - Cleanliness / clutter removal     (15pts)
 *  - Vertical/horizontal alignment     (15pts)
 *  - Resolution & sharpness            (15pts)
 *  - Colour grading & white balance    (10pts)
 *  - AEO metadata (alt-text, EXIF)     (5pts)
 *
 * Uses Gemini Vision API for analysis — no extra keys needed (GEMINI_API_KEY).
 * Cost: ~$0.004 per photo analysis (Gemini 1.5 Flash pricing).
 *
 * Revenue tiers (Billing dept shows these):
 *   Score 0–69:   Basic tier — $14.99/listing (SIO target: 70+)
 *   Score 70–79:  Pro tier   — $24.99/listing (SIO target: 80+)
 *   Score 80–89:  Elite tier — $44.99/listing (SIO target: 90+)
 *   Score 90–100: Ultra tier — $79.99/listing (SIO target: 95+)
 */

import { GoogleGenerativeAI, Part } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export interface PhotoScore {
  photoIndex: number;
  photoUrl: string;
  totalScore: number;        // 0–100
  dimensions: ScoreDimension[];
  aeoScore: number;          // 0–100 (used for Airbnb algo boost estimate)
  recommendedOps: RecommendedOp[];
  projectedScoreAfterRetouch: number;
  estimatedRevenueBoost: number; // % increase in nightly rate
}

export interface ScoreDimension {
  name: string;
  score: number;
  maxScore: number;
  notes: string;
}

export interface RecommendedOp {
  tool: 'topaz' | 'autoenhance' | 'imagen' | 'manual';
  operation: string;
  estimatedCostUsd: number;
  expectedGain: number; // pts
}

export interface ListingIEOReport {
  listingUrl: string;
  overallScore: number;
  tier: 'basic' | 'pro' | 'elite' | 'ultra';
  servicePriceUsd: number;
  vsProPhotographer: string;
  vsFreelancer: string;
  photoScores: PhotoScore[];
  projectedNightlyRateIncrease: number; // %
  analysisTimeSec: number;
  analysisCostUsd: number;
}

// ── SIO Collaboration Loop Types ────────────────────────────────

export interface SIOFeedback {
  score: number;
  passed: boolean;
  tier: 'basic' | 'pro' | 'elite' | 'ultra';
  feedback: string[];              // Actionable items for retoucher
  dimensions: ScoreDimension[];
  costUsd: number;
}

export const TIER_THRESHOLDS: Record<string, number> = {
  basic: 70,
  pro: 80,
  elite: 90,
  ultra: 95,
};

/**
 * Analyse all photos from a listing and produce a full IEO report.
 */
export async function scoreListingPhotos(
  listingUrl: string,
  photoUrls: string[],
  onProgress?: (msg: string) => void
): Promise<ListingIEOReport> {
  const start = Date.now();
  const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

  const photoScores: PhotoScore[] = [];

  for (let i = 0; i < photoUrls.length; i++) {
    onProgress?.(`Analysing photo ${i + 1}/${photoUrls.length}…`);
    const score = await analysePhoto(model, i, photoUrls[i]);
    photoScores.push(score);
  }

  const overallScore = Math.round(
    photoScores.reduce((s, p) => s + p.totalScore, 0) / photoScores.length
  );

  const tier = getTier(overallScore);
  const servicePrice = getTierPrice(tier);
  const projectedIncrease = getRevenueIncrease(overallScore);
  const costUsd = photoUrls.length * 0.004;

  return {
    listingUrl,
    overallScore,
    tier,
    servicePriceUsd: servicePrice,
    vsProPhotographer: `Save $${(600 - servicePrice).toFixed(0)} vs pro photographer ($600 avg)`,
    vsFreelancer: `Save $${(140 - servicePrice).toFixed(0)} vs freelance retoucher ($140 avg)`,
    photoScores,
    projectedNightlyRateIncrease: projectedIncrease,
    analysisTimeSec: (Date.now() - start) / 1000,
    analysisCostUsd: costUsd,
  };
}

async function analysePhoto(
  model: any,
  index: number,
  url: string
): Promise<PhotoScore> {
  const prompt = `You are an expert Airbnb listing photo analyst. Analyse this image and score it.

Return ONLY valid JSON in this exact format:
{
  "dimensions": [
    {"name": "Lighting quality & warmth", "score": 0, "maxScore": 20, "notes": ""},
    {"name": "Staging & furniture", "score": 0, "maxScore": 20, "notes": ""},
    {"name": "Cleanliness & clutter", "score": 0, "maxScore": 15, "notes": ""},
    {"name": "Vertical/horizontal alignment", "score": 0, "maxScore": 15, "notes": ""},
    {"name": "Resolution & sharpness", "score": 0, "maxScore": 15, "notes": ""},
    {"name": "Colour grading", "score": 0, "maxScore": 10, "notes": ""},
    {"name": "AEO metadata readiness", "score": 0, "maxScore": 5, "notes": ""}
  ],
  "recommendedOps": [
    {"tool": "topaz|autoenhance|imagen|manual", "operation": "", "estimatedCostUsd": 0, "expectedGain": 0}
  ],
  "estimatedRevenueBoost": 0
}`;

  try {
    // Fetch image as base64 for Gemini Vision
    const imgRes = await fetch(url);
    const buffer = await imgRes.arrayBuffer();
    const b64 = Buffer.from(buffer).toString('base64');
    const mimeType = imgRes.headers.get('content-type') || 'image/jpeg';

    const imagePart: Part = { inlineData: { data: b64, mimeType } };
    const result = await model.generateContent([prompt, imagePart]);
    const text = result.response.text().trim();
    const json = JSON.parse(text.replace(/```json\n?|\n?```/g, ''));

    const totalScore = json.dimensions.reduce((s: number, d: ScoreDimension) => s + d.score, 0);

    return {
      photoIndex: index,
      photoUrl: url,
      totalScore,
      dimensions: json.dimensions,
      aeoScore: Math.round((totalScore / 100) * 100),
      recommendedOps: json.recommendedOps ?? [],
      projectedScoreAfterRetouch: Math.min(100, totalScore + 18),
      estimatedRevenueBoost: json.estimatedRevenueBoost ?? 10,
    };
  } catch (e) {
    // Return a placeholder score if vision fails
    return {
      photoIndex: index,
      photoUrl: url,
      totalScore: 62,
      dimensions: getDefaultDimensions(),
      aeoScore: 62,
      recommendedOps: [{ tool: 'autoenhance', operation: 'Auto-enhance all', estimatedCostUsd: 0.29, expectedGain: 15 }],
      projectedScoreAfterRetouch: 77,
      estimatedRevenueBoost: 12,
    };
  }
}

// ── Helpers ──────────────────────────────────────────────────────

function getTier(score: number): ListingIEOReport['tier'] {
  if (score >= 95)  return 'ultra';
  if (score >= 90)  return 'elite';
  if (score >= 80)  return 'pro';
  return 'basic';
}

function getTierPrice(tier: ListingIEOReport['tier']): number {
  return { basic: 14.99, pro: 24.99, elite: 44.99, ultra: 79.99 }[tier];
}

function getRevenueIncrease(score: number): number {
  if (score >= 90) return 32;
  if (score >= 80) return 22;
  if (score >= 70) return 14;
  return 8;
}

function getDefaultDimensions(): ScoreDimension[] {
  return [
    { name: 'Lighting quality & warmth',      score: 11, maxScore: 20, notes: 'Analysis unavailable' },
    { name: 'Staging & furniture',            score: 12, maxScore: 20, notes: '' },
    { name: 'Cleanliness & clutter',          score: 10, maxScore: 15, notes: '' },
    { name: 'Vertical/horizontal alignment',  score:  9, maxScore: 15, notes: '' },
    { name: 'Resolution & sharpness',         score:  9, maxScore: 15, notes: '' },
    { name: 'Colour grading',                 score:  7, maxScore: 10, notes: '' },
    { name: 'AEO metadata readiness',         score:  4, maxScore:  5, notes: '' },
  ];
}

// ── SIO Scorer: Score + Feedback for Retoucher Loop ─────────────

/**
 * Score a single local image file against SIO dimensions.
 * Returns a score + actionable feedback if below the target tier threshold.
 * This is the function the collaboration loop uses.
 */
export async function scoreAndFeedback(
  imagePath: string,
  targetTier: 'basic' | 'pro' | 'elite' | 'ultra',
  context: string = '',
  onProgress?: (msg: string) => void
): Promise<SIOFeedback> {
  const threshold = TIER_THRESHOLDS[targetTier] || 80;
  const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

  const prompt = `You are Priya, an SIO (Search & Image Optimisation) specialist for Airbnb listings.
Analyse this property photo and score it across 7 dimensions.

Context: ${context}
Target tier: ${targetTier.toUpperCase()} (minimum score: ${threshold}/100)

Return ONLY valid JSON:
{
  "dimensions": [
    {"name": "Lighting quality & warmth", "score": 0, "maxScore": 20, "notes": ""},
    {"name": "Staging & furniture", "score": 0, "maxScore": 20, "notes": ""},
    {"name": "Cleanliness & clutter", "score": 0, "maxScore": 15, "notes": ""},
    {"name": "Vertical/horizontal alignment", "score": 0, "maxScore": 15, "notes": ""},
    {"name": "Resolution & sharpness", "score": 0, "maxScore": 15, "notes": ""},
    {"name": "Colour grading", "score": 0, "maxScore": 10, "notes": ""},
    {"name": "AEO metadata readiness", "score": 0, "maxScore": 5, "notes": ""}
  ],
  "feedback": ["actionable item 1 for retoucher", "actionable item 2"]
}`;

  try {
    const fs = await import('fs');
    const imageData = fs.readFileSync(imagePath);
    const b64 = imageData.toString('base64');
    
    onProgress?.('Running SIO 7-dimension audit…');

    const result = await model.generateContent([
      prompt,
      { inlineData: { data: b64, mimeType: 'image/jpeg' } }
    ]);

    const text = result.response.text().trim();
    const json = JSON.parse(text.replace(/```json\n?|\n?```/g, ''));
    const totalScore = json.dimensions.reduce((s: number, d: any) => s + d.score, 0);
    const passed = totalScore >= threshold;

    onProgress?.(`SIO Score: ${totalScore}/100 (target: ${threshold}+) ${passed ? '✓ PASS' : '✗ BELOW THRESHOLD'}`);

    // Build actionable feedback for retoucher
    const feedback: string[] = json.feedback || [];
    if (!passed) {
      // Add dimension-specific feedback for low-scoring areas
      for (const dim of json.dimensions) {
        const pct = dim.score / dim.maxScore;
        if (pct < 0.6 && dim.notes) {
          feedback.push(`${dim.name}: ${dim.notes} (${dim.score}/${dim.maxScore})`);
        }
      }
    }

    return {
      score: totalScore,
      passed,
      tier: getTier(totalScore),
      feedback,
      dimensions: json.dimensions,
      costUsd: 0.004,
    };
  } catch (err) {
    console.error('[SIO] Scoring failed:', err);
    onProgress?.('SIO scoring failed — using baseline heuristic');
    return {
      score: 62,
      passed: false,
      tier: 'basic',
      feedback: ['Unable to score — retoucher should apply standard corrections'],
      dimensions: getDefaultDimensions(),
      costUsd: 0.001,
    };
  }
}
