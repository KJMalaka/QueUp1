/**
 * POST /api/ticket
 * Mock implementation — returns a realistic ticket without hitting Firestore.
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const BodySchema = z.object({
  branchId: z.string().min(1),
  citizenName: z.string().min(1).max(100),
  citizenPhone: z.string().optional(),
  category: z.enum([
    'SMART_ID',
    'PASSPORT',
    'BIRTH_CERTIFICATE',
    'TAX_QUERY',
    'SASSA',
    'MUNICIPAL_RATES',
    'OTHER',
  ]),
  isPriority: z.boolean().optional().default(false),
  channel: z.enum(['QR', 'KIOSK', 'APP']),
  paymentStatus: z.enum(['FREE', 'PENDING', 'PAID']).optional().default('FREE'),
  edgeAiPrediction: z.number().int().min(0).optional(),
});

const DEPT_PREFIX: Record<string, string> = {
  'ha-bellville': 'HA',
  'ha-cbd': 'HA',
  'ha-mitchells-plain': 'HA',
  'sassa-tygervalley': 'SA',
  'sars-pinelands': 'SR',
};

export async function POST(req: NextRequest) {
  try {
    const json = await req.json();
    const parsed = BodySchema.safeParse(json);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: 'Invalid request body',
          details: parsed.error.flatten(),
        },
        { status: 400 }
      );
    }

    const { branchId, citizenName, category, channel } = parsed.data;

    const prefix = DEPT_PREFIX[branchId] ?? 'TK';
    const num = Math.floor(Math.random() * 60) + 10;
    const ticketNumber = `${prefix}-${String(num).padStart(3, '0')}`;
    const ticketId = `mock_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const queuePosition = Math.floor(Math.random() * 15) + 1;
    const estimatedWait = queuePosition * 7;

    const ticket = {
      ticketId,
      ticketNumber,
      branchId,
      citizenName,
      status: 'WAITING',
      category,
      channel,
      queuePositionAtIssue: queuePosition,
      estimatedWait,
      issuedAt: new Date().toISOString(),
    };

    return NextResponse.json({ ticket }, { status: 201 });
  } catch (err) {
    console.error('[POST /api/ticket]', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}