/**
 * POST /api/q-chat
 * Q Assistant — real-time multilingual chat powered by Claude.
 * Supports English, Zulu, Xhosa, and Afrikaans.
 */
import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

type Language = 'English' | 'Zulu' | 'Xhosa' | 'Afrikaans';

type ChatHistoryEntry = {
  role: 'user' | 'assistant';
  content: string;
};

const SYSTEM_PROMPTS: Record<Language, string> = {
  English: `You are Q, the intelligent queue assistant for South African government services (Home Affairs, SASSA, DLTC, and more).
Your job: help citizens join queues, get ticket numbers, find the right service, and minimise waiting time.

Services you know:
- Smart ID Card (Home Affairs)
- Passport Application & Renewal (Home Affairs)
- Birth / Death / Marriage Certificate (Home Affairs)
- SASSA Grant Application & Status (SASSA)
- Driver's & Learner's Licence (DLTC)
- Vehicle Registration (DLTC)

When someone asks for help:
1. Identify what service they need.
2. Issue them a ticket number formatted like Q-XXX (e.g. Q-471).
3. Give an estimated wait time (typically 5–45 minutes depending on time of day).
4. Tell them Q will SMS them 5 minutes before their turn.
5. Offer 1 short, practical tip.

Keep responses concise — 2 to 4 sentences maximum. Never repeat yourself. Be warm, clear, and direct.`,

  Zulu: `Wena uQ, umsizi ohlakaniphile wezinsiza zikahulumeni waseNingizimu Afrika (Izindaba ZaseKhaya, SASSA, DLTC, nokunye).
Umsebenzi wakho: siza izakhamuzi ukubhalisa emgqeni, nokunika amathikithi, nokuthola insiza efanelekile.

Uma umuntu ebuza:
1. Thola ukuthi yisiphi isevisi abafunayo.
2. Banika inombolo yethikithi efana ne-Q-XXX (isb. Q-471).
3. Banika isikhathi sokulinda (cishe imizuzu eyi-5 kuya kwi-45 ngokwesikhathi).
4. Baxelele ukuthi uQ uzobathumela i-SMS imizuzu emihlanu ngaphambi kwabo.
5. Nika iseluleko esisodwa esisebenzayo.

Gcina izimpendulo zimfutshane — imishwi eyi-2 kuya kwi-4 kuphela. Yiba nomusa, ucace, futhi uqondile.`,

  Xhosa: `UQ usisi womgca weenkonzo zikarhulumente weMzantsi Afrika (Imicimbi yaseKhaya, SASSA, DLTC, nezinye).
Umsebenzi wakho: nceda abantu bangene kumgca, bafumane iitikiti, bafumane inkonzo efanelekile.

Xa umntu ebuza:
1. Fumanisa inkonzo abayifunayo.
2. Mpe inombolo yetikiti efana ne-Q-XXX (umzekelo Q-471).
3. Mxelele ixesha lokulinda (ngokwejelo imizuzu eyi-5 ukuya kwi-45).
4. Mxelele ukuba uQ uzamthumela i-SMS imizuzu emi-5 ngaphambi kwexesha lakhe.
5. Mpe ingcebiso enye ebalulekileyo.

Gcina iimpendulo zimfutshane — izivakalisi ezi-2 ukuya kwi-4 kuphela. Yiba nobubele, ucacile, uthe ngqo.`,

  Afrikaans: `Jy is Q, die intelligente tou-assistent vir Suid-Afrikaanse staatsdienste (Binnelandse Sake, SASSA, DLTC, en meer).
Jou taak: help burgers in toue staan, kaartjies kry, en die regte diens vind.

Wanneer iemand vra:
1. Bepaal watter diens hulle benodig.
2. Gee hulle 'n kaartjienommer in die formaat Q-XXX (bv. Q-471).
3. Gee 'n geskatte wagtyd (gewoonlik 5–45 minute).
4. Sê vir hulle Q sal hulle 'n SMS stuur 5 minute voor hul beurt.
5. Gee een praktiese wenk.

Hou antwoorde bondig — 2 tot 4 sinne maksimum. Wees vriendelik, duidelik en direk.`,
};

function heuristicReply(language: Language, message: string): string {
  const ticket = `Q-${Math.floor(100 + Math.random() * 900)}`;
  const wait = 10 + Math.floor(Math.random() * 25);

  const lower = message.toLowerCase();
  let service = 'your service';
  if (lower.includes('passport')) service = 'Passport';
  else if (lower.includes('id') || lower.includes('smart')) service = 'Smart ID';
  else if (lower.includes('birth')) service = 'Birth Certificate';
  else if (lower.includes('marriage')) service = 'Marriage Certificate';
  else if (lower.includes('license') || lower.includes('licence')) service = "Driver's Licence";
  else if (lower.includes('grant') || lower.includes('sassa')) service = 'SASSA Grant';

  const replies: Record<Language, string> = {
    English: `Your ticket for ${service} is **${ticket}**. Estimated wait is about ${wait} minutes. Please have your documents ready. Q will SMS you 5 minutes before your turn.`,
    Zulu: `Ithikithi lakho le-${service} ngu **${ticket}**. Isikhathi sokulinda cishe imizuzu engu ${wait}. Lungisa izincwadi zakho. Sizokuthumela i-SMS emizuzwini emihlanu ngaphambi kwakho.`,
    Xhosa: `Itikiti lakho le-${service} ngu **${ticket}**. Ixesha lokulinda limalunga nemizuzu eyi-${wait}. Lungisa amaxwebhu akho. Siza kukuthumela i-SMS imizuzu emi-5 ngaphambi kwethuba lakho.`,
    Afrikaans: `Jou kaartjie vir ${service} is **${ticket}**. Geskatte wagtyd is ongeveer ${wait} minute. Maak asseblief jou dokumente gereed. Q stuur 'n SMS 5 minute voor jou beurt.`,
  };

  return replies[language];
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      message: string;
      language?: Language;
      history?: ChatHistoryEntry[];
    };

    const { message, history = [] } = body;
    const language: Language = (['English', 'Zulu', 'Xhosa', 'Afrikaans'].includes(body.language ?? '') ? body.language : 'English') as Language;

    if (!message?.trim()) {
      return NextResponse.json({ error: 'message is required' }, { status: 400 });
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json({
        reply: heuristicReply(language, message),
        source: 'heuristic',
      });
    }

    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const systemPrompt = `${SYSTEM_PROMPTS[language]}

Current time: ${new Date().toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' })}
Day: ${new Date().toLocaleDateString('en-ZA', { weekday: 'long' })}`;

    const messages: Anthropic.MessageParam[] = [
      ...history.slice(-8).map((h) => ({
        role: h.role as 'user' | 'assistant',
        content: h.content,
      })),
      { role: 'user', content: message },
    ];

    try {
      const completion = await anthropic.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 320,
        system: systemPrompt,
        messages,
      });

      const reply = completion.content[0]?.type === 'text'
        ? completion.content[0].text.trim()
        : heuristicReply(language, message);

      return NextResponse.json({ reply, source: 'claude' });
    } catch (anthropicErr) {
      console.warn('[POST /api/q-chat] Anthropic unavailable, using heuristic:', anthropicErr);
      return NextResponse.json({ reply: heuristicReply(language, message), source: 'heuristic' });
    }
  } catch (err) {
    console.error('[POST /api/q-chat]', err);
    return NextResponse.json({ error: 'Chat unavailable' }, { status: 500 });
  }
}
