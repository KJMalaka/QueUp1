/**
 * POST /api/q-route
 * Intelligent branch routing powered by Claude.
 * Takes a natural-language service description and returns the best branch
 * to visit based on live queue data, minimising citizen wait time.
 */
import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { db } from '@/lib/firebase-admin';
import { COLLECTIONS, Branch, SEED_BRANCHES } from '@/lib/firestore-schema';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export type BranchCard = {
  id: string;
  name: string;
  address: string;
  city: string;
  province: string;
  congestionLevel: 'LOW' | 'MODERATE' | 'HIGH' | 'FULL';
  currentQueue: number;
  capacity: number;
  estimatedWaitMinutes: number;
  serviceTypes: string[];
  isOpen: boolean;
  department: string;
};

export type RoutingResponse = {
  recommendedBranch: BranchCard;
  alternativeBranches: BranchCard[];   // LOW / MODERATE — usable options
  busyBranches: BranchCard[];          // HIGH / FULL — branches to avoid
  reasoning: string;
  serviceMatched: string;
  source: 'claude' | 'heuristic';
};

/** Detect if a branch offers the service implied by the query */
function branchServesQuery(branch: Branch, query: string): boolean {
  const q = query.toLowerCase();
  const services = branch.serviceTypes.map((s) => s.toLowerCase());

  const matchers: [string[], string[]][] = [
    [['passport'], ['passport']],
    [['smart id', 'id card', 'id book'], ['smart_id']],
    [['birth', 'born'], ['birth_cert']],
    [['marriage', 'wed'], ['marriage_cert']],
    [['death', 'death cert'], ['death_cert']],
    [['driver', 'licence', 'license', 'learner'], ['drivers_license', 'learners_license']],
    [['vehicle', 'car', 'registration', 'rego'], ['vehicle_reg']],
    [['grant', 'sassa', 'pension', 'disability', 'social'], ['grant_application', 'grant_status', 'disability']],
  ];

  for (const [keywords, types] of matchers) {
    if (keywords.some((kw) => q.includes(kw))) {
      return types.some((t) => services.some((s) => s.includes(t)));
    }
  }
  return true; // no specific service detected → show all
}

function toBranchCard(branch: Branch): BranchCard {
  return {
    id: branch.id,
    name: branch.name,
    address: branch.address,
    city: branch.city,
    province: branch.province,
    congestionLevel: branch.congestionLevel,
    currentQueue: branch.currentQueue,
    capacity: branch.capacity,
    estimatedWaitMinutes: Math.round(branch.currentQueue * branch.avgServiceTime),
    serviceTypes: branch.serviceTypes,
    isOpen: branch.isOpen,
    department: branch.department,
  };
}

function sortByWait(branches: Branch[]): Branch[] {
  return [...branches]
    .filter((b) => b.isOpen)
    .sort(
      (a, b) =>
        a.currentQueue * a.avgServiceTime - b.currentQueue * b.avgServiceTime,
    );
}

async function fetchBranches(): Promise<Branch[]> {
  try {
    const snap = await db.collection(COLLECTIONS.BRANCHES).where('isOpen', '==', true).get();
    if (!snap.empty) {
      return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Branch));
    }
  } catch (err) {
    console.warn('[POST /api/q-route] Firestore unavailable, using seed data:', err);
  }

  // Fallback: use seed branches with simulated live data
  return SEED_BRANCHES.map((b, i) => ({
    ...b,
    id: `branch-${i + 1}`,
    // Simulate slight queue variation so the demo is interesting
    currentQueue: Math.max(1, b.currentQueue + Math.floor((Math.random() - 0.5) * 6)),
    createdAt: null as unknown as import('firebase-admin/firestore').Timestamp,
    updatedAt: null as unknown as import('firebase-admin/firestore').Timestamp,
  }));
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { serviceQuery?: string };
    const serviceQuery = (body.serviceQuery ?? '').trim();

    if (!serviceQuery) {
      return NextResponse.json({ error: 'serviceQuery is required' }, { status: 400 });
    }

    const allBranches = await fetchBranches();
    const relevant = allBranches.filter((b) => branchServesQuery(b, serviceQuery));
    const sorted = sortByWait(relevant.length > 0 ? relevant : allBranches);

    if (sorted.length === 0) {
      return NextResponse.json({ error: 'No open branches found' }, { status: 404 });
    }

    const cards = sorted.map(toBranchCard);
    const [best, ...rest] = cards;

    // Split remaining branches: usable (LOW/MODERATE) vs overloaded (HIGH/FULL)
    const quietAlts = rest.filter((b) => b.congestionLevel === 'LOW' || b.congestionLevel === 'MODERATE').slice(0, 2);
    const busyBranches = rest.filter((b) => b.congestionLevel === 'HIGH' || b.congestionLevel === 'FULL');

    // Heuristic fallback recommendation
    const heuristicResult: RoutingResponse = {
      recommendedBranch: best,
      alternativeBranches: quietAlts,
      busyBranches,
      reasoning: `${best.name} currently has the shortest estimated wait at ${best.estimatedWaitMinutes} minutes with ${best.congestionLevel.toLowerCase()} congestion (${best.currentQueue}/${best.capacity} people in queue). ${quietAlts[0] ? `${quietAlts[0].name} is also a good option at ~${quietAlts[0].estimatedWaitMinutes} minutes.` : ''}${busyBranches.length > 0 ? ` Avoid ${busyBranches.map(b => b.name).join(' and ')} — currently overloaded.` : ''}`,
      serviceMatched: serviceQuery,
      source: 'heuristic',
    };

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json(heuristicResult);
    }

    const systemPrompt = `You are Q, the intelligent queue routing advisor for South African government services.
Given a citizen's natural-language request and live branch data, pick the SINGLE best branch for them to visit right now.
Prioritise: lowest wait time → service availability → open status.

Respond ONLY with valid JSON:
{
  "recommendedBranchId": "string",
  "reasoning": "string — 1-2 sentences explaining the choice in plain English",
  "serviceMatched": "string — the service you detected from the query"
}`;

    const userMessage = `Citizen request: "${serviceQuery}"

Live branch data (sorted by current wait time, shortest first):
${cards
  .map(
    (b, i) =>
      `${i + 1}. ${b.name} [ID: ${b.id}]
   City: ${b.city} | Department: ${b.department}
   Queue: ${b.currentQueue}/${b.capacity} | Wait: ~${b.estimatedWaitMinutes} min | Congestion: ${b.congestionLevel}
   Services: ${b.serviceTypes.join(', ')}`,
  )
  .join('\n\n')}

Which branch ID should this citizen go to?`;

    try {
      const message = await anthropic.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 300,
        system: systemPrompt,
        messages: [{ role: 'user', content: userMessage }],
      });

      const raw = message.content[0]?.type === 'text' ? message.content[0].text : '{}';
      const match = raw.match(/\{[\s\S]*\}/);

      let parsed: { recommendedBranchId?: string; reasoning?: string; serviceMatched?: string } = {};
      try {
        parsed = JSON.parse(match ? match[0] : raw);
      } catch {
        parsed = {};
      }

      const recommended = cards.find((b) => b.id === parsed.recommendedBranchId) ?? best;
      const others = cards.filter((b) => b.id !== recommended.id);
      const alternatives = others.filter((b) => b.congestionLevel === 'LOW' || b.congestionLevel === 'MODERATE').slice(0, 2);
      const busyBranches = others.filter((b) => b.congestionLevel === 'HIGH' || b.congestionLevel === 'FULL');

      return NextResponse.json({
        recommendedBranch: recommended,
        alternativeBranches: alternatives,
        busyBranches,
        reasoning: parsed.reasoning || heuristicResult.reasoning,
        serviceMatched: parsed.serviceMatched || serviceQuery,
        source: 'claude',
      } satisfies RoutingResponse);
    } catch (anthropicErr) {
      console.warn('[POST /api/q-route] Anthropic unavailable, using heuristic:', anthropicErr);
      return NextResponse.json(heuristicResult);
    }
  } catch (err) {
    console.error('[POST /api/q-route]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
