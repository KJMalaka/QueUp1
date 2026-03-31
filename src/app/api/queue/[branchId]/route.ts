/**
 * GET /api/queue/[branchId]
 * Mock implementation — returns live-looking queue data without Firestore.
 */

import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const MOCK_BRANCHES: Record<string, {
  name: string; currentQueue: number; estimatedWait: number;
  congestionLevel: string; branchStatus: string;
  surgeProbability: number; bestTimeToVisit: string;
}> = {
  'ha-bellville':       { name: 'Home Affairs Bellville',         currentQueue: 12, estimatedWait: 84,  congestionLevel: 'MODERATE', branchStatus: 'OPEN', surgeProbability: 35, bestTimeToVisit: '14:00–15:00' },
  'ha-cbd':             { name: 'Home Affairs Cape Town CBD',      currentQueue: 5,  estimatedWait: 35,  congestionLevel: 'LOW',      branchStatus: 'OPEN', surgeProbability: 10, bestTimeToVisit: '08:00–09:00' },
  'ha-mitchells-plain': { name: 'Home Affairs Mitchells Plain',    currentQueue: 80, estimatedWait: 280, congestionLevel: 'HIGH',     branchStatus: 'FULL', surgeProbability: 95, bestTimeToVisit: 'Early morning tomorrow' },
  'sassa-tygervalley':  { name: 'SASSA Tygervalley',              currentQueue: 8,  estimatedWait: 56,  congestionLevel: 'LOW',      branchStatus: 'OPEN', surgeProbability: 10, bestTimeToVisit: '14:00–15:00' },
  'sars-pinelands':     { name: 'SARS Pinelands',                 currentQueue: 3,  estimatedWait: 21,  congestionLevel: 'LOW',      branchStatus: 'OPEN', surgeProbability: 10, bestTimeToVisit: '09:00–10:00' },
};

function makeMockTickets(branchId: string, count: number) {
  const prefix = branchId.startsWith('ha') ? 'HA' : branchId.startsWith('sa') ? 'SA' : 'SR';
  return Array.from({ length: count }, (_, i) => ({
    ticketId: `mock_ticket_${branchId}_${i + 1}`,
    ticketNumber: `${prefix}-${String(i + 1).padStart(3, '0')}`,
    branchId,
    citizenName: ['Thabo', 'Nomsa', 'Sipho', 'Lindiwe', 'Kagiso'][i % 5],
    status: i === 0 ? 'CALLED' : 'WAITING',
    category: ['SMART_ID', 'PASSPORT', 'BIRTH_CERTIFICATE', 'TAX_QUERY', 'SASSA'][i % 5],
    queuePositionAtIssue: i + 1,
    estimatedWait: (i + 1) * 7,
    issuedAt: new Date(Date.now() - i * 8 * 60000).toISOString(),
  }));
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ branchId: string }> }
) {
  const { branchId } = await params;

  const branch = MOCK_BRANCHES[branchId];
  if (!branch) {
    return NextResponse.json({ error: 'Branch not found' }, { status: 404 });
  }

  const ticketCount = Math.min(branch.currentQueue, 8);
  const tickets = makeMockTickets(branchId, ticketCount);

  return NextResponse.json({
    branch: { id: branchId, ...branch },
    tickets,
    prediction: {
      predictedWaitMinutes: branch.estimatedWait,
      confidence: 0.82,
      source: 'MOCK',
    },
    liveStats: {
      waiting: tickets.filter(t => t.status === 'WAITING').length,
      called: tickets.filter(t => t.status === 'CALLED').length,
      estimatedWait: branch.estimatedWait,
      congestionLevel: branch.congestionLevel,
      branchStatus: branch.branchStatus,
      surgeProbability: branch.surgeProbability,
      bestTimeToVisit: branch.bestTimeToVisit,
    },
  });
}
