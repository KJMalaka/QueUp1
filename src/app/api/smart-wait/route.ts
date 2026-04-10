import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

type SmartWaitBody = {
  service?: string;
  queuePosition?: number;
  staffCount?: number;
  queueVelocity?: number;
};

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function servicePrefix(service: string) {
  const lower = service.toLowerCase();
  if (lower.includes('passport')) return 'P';
  if (lower.includes('id')) return 'I';
  if (lower.includes('birth')) return 'B';
  if (lower.includes('marriage')) return 'M';
  if (lower.includes('permit')) return 'R';
  return 'Q';
}

function heuristicEta(input: Required<SmartWaitBody>) {
  const now = new Date();
  const day = now.getDay();
  const hour = now.getHours();

  const isPeakHour = hour >= 9 && hour <= 11;
  const isBusyDay = day === 1 || day === 5;

  const queuePressure = input.queuePosition / Math.max(input.staffCount, 1);
  const velocityModifier = input.queueVelocity > 8 ? 0.9 : input.queueVelocity < 5 ? 1.15 : 1;
  const timeModifier = isPeakHour ? 1.2 : 1;
  const dayModifier = isBusyDay ? 1.1 : 1;

  const etaMinutes = Math.round(queuePressure * 10 * velocityModifier * timeModifier * dayModifier);

  const confidenceRaw = 88 - Math.abs(input.queueVelocity - 7) * 3 - (input.queuePosition > 30 ? 8 : 0);
  const confidence = clamp(Math.round(confidenceRaw), 62, 96);

  return { etaMinutes, confidence };
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as SmartWaitBody;
    const input: Required<SmartWaitBody> = {
      service: body.service || 'General Service',
      queuePosition: clamp(Number(body.queuePosition) || 1, 1, 200),
      staffCount: clamp(Number(body.staffCount) || 1, 1, 30),
      queueVelocity: clamp(Number(body.queueVelocity) || 6, 1, 30),
    };

    const ticketNumber = `${servicePrefix(input.service)}-${String(Math.floor(100 + Math.random() * 900))}`;
    const fallback = heuristicEta(input);

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json({
        etaMinutes: fallback.etaMinutes,
        confidence: fallback.confidence,
        ticketNumber,
        smsNotice: 'Q will SMS you 5 minutes before your turn.',
        source: 'heuristic',
      });
    }

    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const system = `You estimate queue ETA for South African public service desks.
Return JSON only with shape:
{
  "etaMinutes": number,
  "confidence": number
}
Rules:
- Use queue position, staff count, queue velocity, time of day, day of week.
- etaMinutes must be integer between 1 and 360.
- confidence must be integer between 50 and 99.`;

    const user = `Service: ${input.service}
Queue position: ${input.queuePosition}
Staff count: ${input.staffCount}
Queue velocity (people/hour): ${input.queueVelocity}
Local timestamp: ${new Date().toISOString()}`;

    try {
      const completion = await anthropic.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 220,
        system,
        messages: [{ role: 'user', content: user }],
      });

      const raw = completion.content[0]?.type === 'text' ? completion.content[0].text : '{}';
      const match = raw.match(/\{[\s\S]*\}/);

      let parsed: { etaMinutes: number; confidence: number } | null = null;
      try {
        const candidate = JSON.parse(match ? match[0] : raw) as { etaMinutes?: number; confidence?: number };
        parsed = {
          etaMinutes: clamp(Math.round(candidate.etaMinutes || fallback.etaMinutes), 1, 360),
          confidence: clamp(Math.round(candidate.confidence || fallback.confidence), 50, 99),
        };
      } catch {
        parsed = null;
      }

      return NextResponse.json({
        etaMinutes: parsed?.etaMinutes ?? fallback.etaMinutes,
        confidence: parsed?.confidence ?? fallback.confidence,
        ticketNumber,
        smsNotice: 'Q will SMS you 5 minutes before your turn.',
        source: 'claude',
      });
    } catch (anthropicError) {
      console.warn('[POST /api/smart-wait] Anthropic unavailable, using heuristic fallback:', anthropicError);
      return NextResponse.json({
        etaMinutes: fallback.etaMinutes,
        confidence: fallback.confidence,
        ticketNumber,
        smsNotice: 'Q will SMS you 5 minutes before your turn.',
        source: 'heuristic',
      });
    }
  } catch (error) {
    console.error('[POST /api/smart-wait]', error);
    return NextResponse.json({ error: 'Unable to compute wait prediction' }, { status: 500 });
  }
}
