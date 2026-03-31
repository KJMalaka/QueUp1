/**
 * GET  /api/ticket/[ticketId]  — fetch a single ticket (mock)
 * PATCH /api/ticket/[ticketId]  — update ticket status (mock, no-op)
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const PatchSchema = z.object({
  status: z.enum(['WAITING', 'CALLED', 'SERVED', 'NO_SHOW', 'CANCELLED']),
});

// In-memory store for mock tickets issued during this server session
const mockTickets: Record<string, {
  ticketId: string; ticketNumber: string; branchId: string;
  citizenName: string; status: string; category: string;
  channel: string; queuePositionAtIssue: number; estimatedWait: number;
  issuedAt: string;
}> = {};

export function registerMockTicket(ticket: typeof mockTickets[string]) {
  mockTickets[ticket.ticketId] = ticket;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ ticketId: string }> }
) {
  const { ticketId } = await params;

  // Return stored mock ticket, or generate a plausible one for demo links
  const ticket = mockTickets[ticketId] ?? {
    ticketId,
    ticketNumber: 'HA-042',
    branchId: 'ha-bellville',
    citizenName: 'Demo User',
    status: 'WAITING',
    category: 'SMART_ID',
    channel: 'QR',
    queuePositionAtIssue: 12,
    estimatedWait: 84,
    issuedAt: new Date().toISOString(),
  };

  return NextResponse.json({ ticket });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ ticketId: string }> }
) {
  const { ticketId } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = PatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten() },
      { status: 422 }
    );
  }

  // Update in-memory mock ticket if it exists
  if (mockTickets[ticketId]) {
    mockTickets[ticketId].status = parsed.data.status;
  }

  return NextResponse.json({ ok: true });
}
