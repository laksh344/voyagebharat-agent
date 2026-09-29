/** Drives the REAL agent loop with a scripted model (no API key, no network): `npm run smoke:agent`
 *  Proves: parallel tool calls, multi-step reasoning, budget tool, streaming to UI parts, route guards. */
import { MockLanguageModelV4 } from 'ai/test';
import { runAgent } from '../lib/agent';
import { POST } from '../app/api/chat/route';

const ok = (c: boolean, m: string) => { console.log(`${c ? '  PASS' : '  FAIL'}  ${m}`); if (!c) process.exitCode = 1; };
const usage = { inputTokens: { total: 10, noCache: 10, cacheRead: 0, cacheWrite: 0 }, outputTokens: { total: 5, text: 5, reasoning: 0 } } as any;
const d = new Date(Date.now() + 14 * 864e5).toISOString().slice(0, 10);
const call = (id: string, toolName: string, input: unknown) => ({ type: 'tool-call' as const, toolCallId: id, toolName, input: JSON.stringify(input) });
const stream = (parts: any[], reason: 'tool-calls' | 'stop') => ({ stream: new ReadableStream({ start(c) { c.enqueue({ type: 'stream-start', warnings: [] }); parts.forEach((p) => c.enqueue(p)); c.enqueue({ type: 'finish', finishReason: { unified: reason, raw: reason }, usage }); c.close(); } }) });

// scripted "LLM": step1 = parallel research, step2 = budget, step3 = final answer
let steps = 0;
const model = new MockLanguageModelV4({
  doStream: async (opts: any) => {
    steps++;
    const toolMsgs = opts.prompt.filter((m: any) => m.role === 'tool').length;
    if (toolMsgs === 0) return stream([
      call('a', 'searchTrains', { from: 'Hyderabad', to: 'Goa', date: d }), call('b', 'searchFlights', { from: 'Hyderabad', to: 'Goa', date: d }),
      call('c', 'searchHotels', { city: 'Goa', checkin: d, nights: 4, maxPricePerNight: 3500 }), call('e', 'getWeather', { city: 'Goa', date: d })], 'tool-calls');
    if (toolMsgs === 1) return stream([call('f', 'estimateBudget', { travelers: 2, budget: 20000, lines: [{ label: 'Train x2', amount: 1240, category: 'transport' }, { label: 'Hotel 4n', amount: 8800, category: 'stay' }, { label: 'Food', amount: 5600, category: 'food' }] })], 'tool-calls');
    return stream([{ type: 'text-start', id: 't' }, { type: 'text-delta', id: 't', delta: 'Take the train: **₹17,204** all-in, inside your budget.' }, { type: 'text-end', id: 't' }], 'stop');
  },
});

(async () => {
  console.log('\n[1] Agent loop (scripted model, real tools)');
  const result = await runAgent([{ id: '1', role: 'user', parts: [{ type: 'text', text: 'Plan a 4-day Goa trip from Hyderabad under ₹20,000 for 2' }] }] as any, model as any);
  const res = result.toUIMessageStreamResponse();
  const raw = await res.text();
  const chunks = raw.split('\n').filter((l) => l.startsWith('data: ') && !l.includes('[DONE]')).map((l) => JSON.parse(l.slice(6)));
  const types = chunks.map((c) => c.type);
  const outputs = chunks.filter((c) => c.type === 'tool-output-available');
  ok(steps === 3, `model was called ${steps}× — reason → research → budget → answer (multi-step loop works)`);
  ok(outputs.length === 5, `${outputs.length} tool results streamed to the UI (4 parallel research calls + budget)`);
  const budget = outputs.find((o) => o.output?.totalWithContingency);
  ok(budget?.output.totalWithContingency === 17204 && budget.output.withinBudget === true, `budget tool ran deterministically: ₹${budget?.output.totalWithContingency}, within budget = ${budget?.output.withinBudget}`);
  ok(types.includes('text-delta') && raw.includes("17,204"), 'final answer text streamed after the tool results');
  ok(types.filter((t) => t === 'tool-input-available').length === 5, 'every tool call exposed to the UI as a tool part');
  ok(types.includes('start-step') && types.includes('finish-step'), 'step boundaries emitted (UI can render progress)');

  console.log('\n[2] Route guards');
  const post = (b: unknown, ip = '9.9.9.9') => POST(new Request('http://x/api/chat', { method: 'POST', headers: { 'content-type': 'application/json', 'x-forwarded-for': ip }, body: typeof b === 'string' ? b : JSON.stringify(b) }));
  ok((await post('{not json')).status === 400, 'malformed JSON → 400');
  ok((await post({ messages: [] })).status === 400, 'empty conversation → 400');
  ok((await post({ messages: [{ id: '1', role: 'user', parts: [{ type: 'text', text: 'x'.repeat(1600) }] }] })).status === 400, 'oversized message → 400');
  let last = 0; for (let i = 0; i < 9; i++) last = (await post({ messages: [] }, '7.7.7.7')).status;
  ok(last === 429, 'per-IP rate limit → 429 after 8 requests/min');
  console.log(process.exitCode ? '\nSOME CHECKS FAILED' : '\nALL CHECKS PASSED');
})();
