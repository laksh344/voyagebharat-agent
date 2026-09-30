// Finds AI Gateway models that (1) your key can use on the free tier and (2) actually make a tool call.
// Run from the project root:   node --env-file=.env.local scripts/find-working-models.mjs
// Optional: how many of the cheapest models to try (default 60):   ... find-working-models.mjs 100
// The API key is read from the environment and never printed.

const KEY = process.env.AI_GATEWAY_API_KEY;
if (!KEY) { console.error('AI_GATEWAY_API_KEY is not set. Put it in .env.local and run with --env-file=.env.local'); process.exit(1); }

const LIMIT = Number(process.argv[2]) || 60;
const BASE = 'https://ai-gateway.vercel.sh/v1';
const tools = [{ type: 'function', function: { name: 'get_weather', description: 'Get the weather for a city', parameters: { type: 'object', properties: { city: { type: 'string' } }, required: ['city'] } } }];

const perM = (v) => (Number(v) || 0) * 1e6;
const fmt = (n) => (n === 0 ? 'free' : `$${n.toFixed(2)}`);

async function probe(id) {
  const body = (tokensKey) => JSON.stringify({ model: id, messages: [{ role: 'user', content: 'What is the weather in Goa? Use the tool.' }], tools, tool_choice: 'auto', [tokensKey]: 300 });
  const call = async (tokensKey) => {
    const r = await fetch(`${BASE}/chat/completions`, { method: 'POST', headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' }, body: body(tokensKey), signal: AbortSignal.timeout(45000) });
    return { status: r.status, text: await r.text() };
  };
  try {
    let { status, text } = await call('max_tokens');
    if (status === 400 && /max_tokens|max_completion_tokens/i.test(text)) ({ status, text } = await call('max_completion_tokens'));
    if (status === 200) {
      const j = JSON.parse(text);
      const calls = j.choices?.[0]?.message?.tool_calls?.length ?? 0;
      return { id, result: calls > 0 ? 'OK' : 'NO_TOOL_CALL' };
    }
    if (status === 403) return { id, result: 'RESTRICTED' };
    if (status === 429) return { id, result: 'RATE_LIMITED' };
    return { id, result: `ERROR_${status}` };
  } catch (e) { return { id, result: 'TIMEOUT_OR_NETWORK' }; }
}

const { data } = await (await fetch(`${BASE}/models`)).json();
const candidates = data
  .filter((m) => m.type === 'language' && (m.tags || []).includes('tool-use'))
  .map((m) => ({ id: m.id, inM: perM(m.pricing?.input), outM: perM(m.pricing?.output) }))
  .sort((a, b) => a.inM + a.outM - (b.inM + b.outM))
  .slice(0, LIMIT);

console.log(`Testing the ${candidates.length} cheapest tool-capable models (of ${data.length} total) ...\n`);
const results = [];
let next = 0;
async function worker() {
  while (next < candidates.length) {
    const c = candidates[next++];
    const r = await probe(c.id);
    results.push({ ...c, ...r });
    if (r.result === 'OK') console.log(`  OK   ${c.id}   in ${fmt(c.inM)}/M  out ${fmt(c.outM)}/M`);
  }
}
await Promise.all([worker(), worker(), worker()]);

const tally = results.reduce((a, r) => ((a[r.result] = (a[r.result] || 0) + 1), a), {});
console.log('\nSummary:', tally);
const ok = results.filter((r) => r.result === 'OK').sort((a, b) => a.inM + a.outM - (b.inM + b.outM));
if (!ok.length) {
  console.log('\nNo model passed. Send me the Summary line above.');
} else {
  console.log('\nWorking models, cheapest first (these accept your key AND made a tool call):');
  ok.forEach((r) => console.log(`  ${r.id}   in ${fmt(r.inM)}/M  out ${fmt(r.outM)}/M`));
  console.log('\nNote: passing one tool call is necessary, not sufficient. The real test is the Goa prompt in the app.');
}
