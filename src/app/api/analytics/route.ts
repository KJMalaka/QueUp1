/**
 * POST /api/analytics — accepts analytics snapshots (mock, no-op store)
 * GET  /api/analytics?branchId=xxx — returns mock historical data
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const PostBodySchema = z.object({
  branchId: z.string().min(1),
  queueCount: z.number().int().min(0),
  congestionLevel: z.enum(['LOW', 'MODERATE', 'HIGH']),
  prediction: z
    .object({
      predictedWaitMinutes: z.number().int().min(0),
      confidence: z.number().min(0).max(1),
      inputs: z.object({
        hourOfDay: z.number().int().min(0).max(23),
        dayOfWeek: z.number().int().min(0).max(6),
        currentQueueSize: z.number().int().min(0),
      }),
    })
    .optional(),
});

function mockHistory(branchId: string) {
  const now = Date.now();
  return Array.from({ length: 24 }, (_, i) => ({
    branchId,
    timestamp: new Date(now - (23 - i) * 30 * 60000).toISOString(),
    queueCount: Math.floor(Math.random() * 40) + 2,
    congestionLevel: ['LOW', 'LOW', 'MODERATE', 'HIGH'][Math.floor(Math.random() * 4)],
  }));
}

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = PostBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten() },
      { status: 422 }
    );
  }

  return NextResponse.json({ ok: true }, { status: 201 });
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const branchId = searchParams.get('branchId');

  if (!branchId) {
    return NextResponse.json({ error: 'branchId query param required' }, { status: 400 });
  }

  return NextResponse.json({ history: mockHistory(branchId) });
}
