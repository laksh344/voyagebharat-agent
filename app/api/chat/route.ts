import { safeValidateUIMessages, type UIMessage } from 'ai';
import { runAgent } from '@/lib/agent';

export const maxDuration = 60;

const MAX_BODY_CHARS = 512_000;   // whole conversation incl. earlier tool results
const MAX_MESSAGES = 40;
const MAX_USER_TEXT = 1500;

// Best-effort per-instance limiter so a public demo can't drain credits.
// (For production, put Vercel WAF rate limiting / BotID in front instead.)
const hits = new Map<string, number[]>();
function limited(ip: string) {
  const now = Date.now();
  if (hits.size > 5000) for (const [k, ts] of hits) if (now - ts[ts.length - 1] >= 60_000) hits.delete(k);
  const win = (hits.get(ip) ?? []).filter((t) => now - t < 60_000);
  win.push(now); hits.set(ip, win);
  return win.length > 8;
}

const textOf = (m: UIMessage) => m.parts.map((p) => (p.type === 'text' ? p.text : '')).join('');
const bad = (error: string, status = 400) => Response.json({ error }, { status });

export async function POST(req: Request) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'local';
  if (limited(ip)) return bad('Too many requests — give it a minute.', 429);

  const raw = await req.text();
  if (raw.length > MAX_BODY_CHARS) return bad('Conversation too long — start a new chat.', 413);
  let body: { messages?: unknown };
  try { body = JSON.parse(raw); } catch { return bad('Invalid JSON.'); }
  if (!Array.isArray(body.messages) || body.messages.length === 0 || body.messages.length > MAX_MESSAGES) return bad('Invalid conversation.');

  // Structural check, then only user/assistant turns: a client-supplied "system" message would override the prompt.
  const checked = await safeValidateUIMessages({ messages: body.messages });
  if (!checked.success) return bad('Invalid conversation.');
  const messages = checked.data;
  if (messages.some((m) => m.role !== 'user' && m.role !== 'assistant')) return bad('Invalid conversation.');
  if (messages.some((m) => m.role === 'user' && textOf(m).length > MAX_USER_TEXT)) return bad(`Message too long (max ${MAX_USER_TEXT} characters).`);

  const result = await runAgent(messages);
  return result.toUIMessageStreamResponse({ onError: () => 'The agent hit a problem. Please try again.' });
}
