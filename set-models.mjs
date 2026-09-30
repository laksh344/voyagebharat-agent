// Sets the agent's default model + fallbacks in lib/agent.ts, .env.example and README.md.
// Run from the project root:
//   node set-models.mjs                                   -> uses the recommended defaults
//   node set-models.mjs openai/gpt-4o-mini "a/b,c/d"      -> custom primary + comma-separated fallbacks
import { readFileSync, writeFileSync } from 'node:fs';

const primary = process.argv[2] || 'openai/gpt-oss-120b';
const fallbacks = (process.argv[3] || 'spacexai/grok-4.1-fast-non-reasoning,openai/gpt-4o-mini').split(',').map((s) => s.trim()).filter(Boolean);
const bad = [primary, ...fallbacks].find((m) => !/^[\w.-]+\/[\w.:-]+$/.test(m));
if (bad) { console.error(`"${bad}" doesn't look like a provider/model id.`); process.exit(1); }

const quoted = fallbacks.map((m) => `'${m}'`).join(', ');
const edits = {
  'lib/agent.ts': [
    [/(process\.env\.AGENT_MODEL \?\? ')[^']*(')/, `$1${primary}$2`],
    [/(process\.env\.AGENT_FALLBACKS \?\? ')[^']*(')/, `$1${fallbacks.join(',')}$2`],
  ],
  '.env.example': [
    [/^# AGENT_MODEL=.*$/m, `# AGENT_MODEL=${primary}`],
    [/^# AGENT_FALLBACKS=.*$/m, `# AGENT_FALLBACKS=${fallbacks.join(',')}`],
  ],
  'README.md': [
    [/(model: ')[^']*(',)/, `$1${primary}$2`],
    [/(models: \[)[^\]]*(\])/, `$1${quoted}$2`],
  ],
};

let failed = false;
for (const [file, rules] of Object.entries(edits)) {
  let text;
  try { text = readFileSync(file, 'utf8'); } catch { console.error(`✗ ${file}: not found — run this from the project root`); failed = true; continue; }
  for (const [re, rep] of rules) {
    if (!re.test(text)) { console.error(`✗ ${file}: couldn't find the line to change (${re})`); failed = true; continue; }
    text = text.replace(re, rep);
  }
  if (!failed) writeFileSync(file, text);
  console.log(`${failed ? '…' : '✓'} ${file}`);
}
if (failed) { console.error('\nNothing was partially written for files listed with ✗ — send me this output.'); process.exit(1); }
console.log(`\nPrimary:   ${primary}\nFallbacks: ${fallbacks.join(', ')}`);
