/**
 * POST /api/redirect
 * Agentic branch redirect powered by Claude claude-sonnet-4-6.
 *
 * When a branch is FULL (409 from /api/ticket), this endpoint:
 *  1. Calculates Haversine distance from citizen to all nearby branches
 *  2. Filters branches that have capacity and match the service type
 *  3. Asks Claude to reason over options and pick the optimal redirect
 *  4. Returns the recommended branch + reasoning
 */
import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { db } from '@/lib/firebase-admin';
import { COLLECTIONS, Branch } from '@/lib/firestore-schema';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

interface RedirectBody {
  branchId: string;           // the full branch
  serviceType: string;
  citizenLocation?: { lat: number; lng: number };
}

/** Haversine distance in km */
function haversineKm(
  lat1: number, lng1: number,
  lat2: number, lng2: number
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export async function POST(req: NextRequest) {
  try {
    const body: RedirectBody = await req.json();
    const { branchId, serviceType, citizenLocation } = body;

    if (!branchId || !serviceType) {
      return NextResponse.json({ error: 'branchId and serviceType are required' }, { status: 400 });
    }

    // ── Fetch the full branch ─────────────────────────────────────────────────
    const fullBranchSnap = await db.collection(COLLECTIONS.BRANCHES).doc(branchId).get();
    if (!fullBranchSnap.exists) {
      return NextResponse.json({ error: 'Branch not found' }, { status: 404 });
    }
    const fullBranch = { id: fullBranchSnap.id, ...fullBranchSnap.data() } as Branch;

    // ── Fetch all branches that serve the same department ─────────────────────
    const candidatesSnap = await db
      .collection(COLLECTIONS.BRANCHES)
      .where('department', '==', fullBranch.department)
      .where('isOpen', '==', true)
      .get();

    // Filter: not the full branch, has capacity, offers the service
    const candidates = candidatesSnap.docs
      .map((d) => ({ id: d.id, ...d.data() } as Branch))
      .filter(
        (b) =>
          b.id !== branchId &&
          b.currentQueue < b.capacity &&
          b.congestionLevel !== 'FULL' &&
          b.serviceTypes.includes(serviceType)
      )
      .map((b) => ({
        ...b,
        distanceKm: citizenLocation
          ? haversineKm(
              citizenLocation.lat, citizenLocation.lng,
              b.coordinates.lat, b.coordinates.lng
            )
          : haversineKm(
              fullBranch.coordinates.lat, fullBranch.coordinates.lng,
              b.coordinates.lat, b.coordinates.lng
            ),
      }))
      .sort((a, b) => a.distanceKm - b.distanceKm)
      .slice(0, 5); // top 5 closest

    if (candidates.length === 0) {
      return NextResponse.json({
        success: false,
        message: 'No alternative branches available at this time.',
        alternatives: [],
      });
    }

    // ── Claude agentic reasoning ──────────────────────────────────────────────
    const systemPrompt = `You are QueUp's agentic redirect engine for South African government services.
A citizen has been turned away from a full branch. Your job is to pick the BEST alternative branch.
Consider: queue length, distance, wait time, and overall experience.
Respond ONLY with a JSON object:
{
  "recommendedBranchId": "string",
  "reasoning": "string — 2-3 sentence explanation for the citizen",
  "estimatedWaitMinutes": number,
  "distanceKm": number
}`;

    const userMessage = `
Full branch: ${fullBranch.name} (${fullBranch.currentQueue}/${fullBranch.capacity} — FULL)
Service needed: ${serviceType}
Citizen needs to visit today.

Alternative branches (sorted by distance):
${candidates.map((c, i) =>
  `${i + 1}. ${c.name}
     Queue: ${c.currentQueue}/${c.capacity} (${c.congestionLevel})
     Est. wait: ${Math.round(c.currentQueue * c.avgServiceTime)} min
     Distance: ${c.distanceKm.toFixed(1)} km
     Branch ID: ${c.id}`
).join('\n\n')}

Pick the single best option for the citizen and explain why.`.trim();

    let claudeResult: {
      recommendedBranchId: string;
      reasoning: string;
      estimatedWaitMinutes: number;
      distanceKm: number;
    };

    try {
      const message = await anthropic.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 400,
        system: systemPrompt,
        messages: [{ role: 'user', content: userMessage }],
      });

      const rawText = message.content[0].type === 'text' ? message.content[0].text : '{}';

      try {
        const jsonMatch = rawText.match(/\{[\s\S]*\}/);
        claudeResult = JSON.parse(jsonMatch ? jsonMatch[0] : rawText);
      } catch {
        const best = candidates[0];
        claudeResult = {
          recommendedBranchId: best.id,
          reasoning: `${best.name} is the closest available branch with ${best.congestionLevel} congestion.`,
          estimatedWaitMinutes: Math.round(best.currentQueue * best.avgServiceTime),
          distanceKm: best.distanceKm,
        };
      }
    } catch (anthropicErr) {
      console.warn('[POST /api/redirect] Anthropic unavailable, using heuristic fallback:', anthropicErr);
      const best = candidates[0];
      claudeResult = {
        recommendedBranchId: best.id,
        reasoning: `${best.name} is the best available alternative based on current queue load and distance.`,
        estimatedWaitMinutes: Math.round(best.currentQueue * best.avgServiceTime),
        distanceKm: best.distanceKm,
      };
    }

    const recommendedBranch = candidates.find((c) => c.id === claudeResult.recommendedBranchId) ?? candidates[0];

    return NextResponse.json({
      success: true,
      source: process.env.ANTHROPIC_API_KEY ? 'claude_or_fallback' : 'heuristic',
      fullBranch: { id: fullBranch.id, name: fullBranch.name },
      recommended: {
        id: recommendedBranch.id,
        name: recommendedBranch.name,
        address: recommendedBranch.address,
        congestionLevel: recommendedBranch.congestionLevel,
        currentQueue: recommendedBranch.currentQueue,
        capacity: recommendedBranch.capacity,
        distanceKm: claudeResult.distanceKm ?? recommendedBranch.distanceKm,
        estimatedWaitMinutes: claudeResult.estimatedWaitMinutes,
        coordinates: recommendedBranch.coordinates,
      },
      reasoning: claudeResult.reasoning,
      alternatives: candidates.map((c) => ({
        id: c.id,
        name: c.name,
        congestionLevel: c.congestionLevel,
        currentQueue: c.currentQueue,
        distanceKm: c.distanceKm,
        estimatedWaitMinutes: Math.round(c.currentQueue * c.avgServiceTime),
      })),
    });
  } catch (err) {
    console.error('[POST /api/redirect]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
