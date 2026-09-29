'use client';
import { useChat } from '@ai-sdk/react';
import { isToolUIPart, getToolName } from 'ai';
import { Fragment, useEffect, useRef, useState, type ReactNode } from 'react';
import { Flights, Trains, Buses, Hotels, Weather, Cab, Budget, Unavailable } from './Cards';

const EXAMPLES = [
  'Plan a 4-day Goa trip from Hyderabad under ₹20,000 for 2',
  'Cheapest way from Delhi to Jaipur this Saturday',
  '5 days in Udaipur from Bengaluru, budget ₹25,000',
  'Manali from Delhi next weekend — what is realistic?',
];
const LABEL: Record<string, string> = { searchFlights: 'Searching flights', searchTrains: 'Checking trains', searchBuses: 'Comparing buses', searchHotels: 'Finding hotels', getWeather: 'Checking the weather', getCabHandoff: 'Pricing local rides', estimateBudget: 'Calculating the budget' };

/** Tiny safe renderer: **bold** and "- " bullets, no HTML injection. */
function inline(s: string): ReactNode[] {
  return s.split(/(\*\*[^*]+\*\*)/g).map((p, i) => (p.startsWith('**') && p.endsWith('**') ? <strong key={i}>{p.slice(2, -2)}</strong> : <Fragment key={i}>{p}</Fragment>));
}
function Text({ text }: { text: string }) {
  const lines = text.split('\n'); const out: ReactNode[] = []; let list: string[] = [];
  const flush = () => { if (list.length) { out.push(<ul key={out.length}>{list.map((l, i) => <li key={i}>{inline(l)}</li>)}</ul>); list = []; } };
  lines.forEach((ln) => { const m = ln.match(/^\s*[-•*]\s+(.*)/); if (m) list.push(m[1]); else { flush(); if (ln.trim()) out.push(<p key={out.length}>{inline(ln.replace(/^#+\s*/, ''))}</p>); } });
  flush(); return <div className="text">{out}</div>;
}

function ToolPart({ part }: { part: any }) {
  const name = getToolName(part) as string;
  if (part.state === 'output-error') return <div className="pending err">⚠ {LABEL[name] ?? name} failed — the agent will work around it.</div>;
  if (part.state !== 'output-available') return <div className="pending" role="status"><span className="spin" aria-hidden="true" />{LABEL[name] ?? name}…</div>;
  const o = part.output;
  if (o && o.available === false) return <Unavailable icon="ℹ️" title={LABEL[name] ?? name} r={o} />;
  switch (name) {
    case 'searchFlights': return <Flights r={o} />;
    case 'searchTrains': return <Trains r={o} />;
    case 'searchBuses': return <Buses r={o} />;
    case 'searchHotels': return <Hotels r={o} />;
    case 'getWeather': return <Weather r={o} />;
    case 'getCabHandoff': return <Cab r={o} />;
    case 'estimateBudget': return <Budget r={o} />;
    default: return null;
  }
}

export default function Chat() {
  const { messages, sendMessage, status, stop, error, setMessages } = useChat();
  const [input, setInput] = useState('');
  const end = useRef<HTMLDivElement>(null);
  const busy = status === 'submitted' || status === 'streaming';
  useEffect(() => { end.current?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'end' }); }, [messages, status]);
  const send = (t: string) => { const v = t.trim(); if (!v || busy) return; sendMessage({ text: v }); setInput(''); };

  return (
    <div className="shell">
      <header className="top">
        <a className="brand" href="/" aria-label="VoyageBHARAT home">
          <svg viewBox="0 0 32 32" width="30" height="30" aria-hidden="true"><rect width="32" height="32" rx="8" fill="#0B1020" /><path d="M7 22C13 8 19 8 25 22" fill="none" stroke="#5B8CFF" strokeWidth="2.4" strokeLinecap="round" /><circle cx="7" cy="22" r="2.6" fill="#14B8A6" /><circle cx="25" cy="22" r="2.6" fill="#F59E0B" /></svg>
          <b>Voyage<span>BHARAT</span></b>
        </a>
        <span className="badge"><i aria-hidden="true" />Agent · routed via Vercel AI Gateway</span>
        {messages.length > 0 && <button className="ghost" onClick={() => { stop(); setMessages([]); }}>New trip</button>}
      </header>

      <main className="thread" role="log" aria-live="polite" aria-label="Conversation">
        {messages.length === 0 && (
          <div className="empty">
            <h1>Where to next?</h1>
            <p>Tell me a trip in plain English. I&apos;ll compare flights, trains and buses, find a stay, check the weather, and add up the real cost.</p>
            <div className="examples">{EXAMPLES.map((e) => <button key={e} onClick={() => send(e)}>{e}</button>)}</div>
          </div>
        )}
        {messages.map((m) => (
          <article key={m.id} className={`msg ${m.role}`}>
            {m.parts.map((p, i) => p.type === 'text' ? (m.role === 'user' ? <p key={i} className="bubble">{p.text}</p> : <Text key={i} text={p.text} />) : isToolUIPart(p) ? <ToolPart key={i} part={p} /> : null)}
          </article>
        ))}
        {status === 'submitted' && <div className="pending" role="status"><span className="spin" aria-hidden="true" />Thinking…</div>}
        {error && <p className="warn" role="alert">Something went wrong. Try again in a moment.</p>}
        <div ref={end} />
      </main>

      <form className="composer" onSubmit={(e) => { e.preventDefault(); send(input); }}>
        <label htmlFor="q" className="sr">Describe your trip</label>
        <input id="q" value={input} onChange={(e) => setInput(e.target.value)} placeholder="e.g. 3 days in Kochi from Chennai, budget ₹15,000" maxLength={1500} autoComplete="off" />
        {busy ? <button type="button" className="send stop" onClick={stop}>Stop</button> : <button type="submit" className="send" disabled={!input.trim()}>Plan trip</button>}
      </form>
      <p className="fine">Prices are modelled estimates, not live inventory. Booking happens on the provider&apos;s site — never here. We never ask for card, phone or OTP.</p>
    </div>
  );
}
