import type { UIMessage } from 'ai';
import { runAgent } from '@/lib/agent';

export const maxDuration = 60;

// Best-effort per-instance limiter so a public demo can't drain credits.
// (For production, put Vercel WAF rate limiting / BotID in front instead.)
const hits = new Map<string, number[]>();
function limited(ip: string) {
  const now = Date.now(), win = (hits.get(ip) ?? []).filter((t) => now - t < 60_000);
  win.push(now); hits.set(ip, win);
  return win.length > 8;
}

export async function POST(req: Request) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'local';
  if (limited(ip)) return Response.json({ error: 'Too many requests — give it a minute.' }, { status: 429 });

  let body: { messages?: UIMessage[] };
  try { body = await req.json(); } catch { return Response.json({ error: 'Invalid JSON.' }, { status: 400 }); }
  const messages = body.messages;
  if (!Array.isArray(messages) || messages.length === 0 || messages.length > 40) return Response.json({ error: 'Invalid conversation.' }, { status: 400 });
  const last = messages[messages.length - 1];
  const text = (last.parts ?? []).map((p) => (p.type === 'text' ? p.text : '')).join('');
  if (text.length > 1500) return Response.json({ error: 'Message too long (max 1500 characters).' }, { status: 400 });

  const result = await runAgent(messages);
  return result.toUIMessageStreamResponse({ onError: () => 'The agent hit a problem. Please try again.' });
}
