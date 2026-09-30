'use client';
import { motion } from 'motion/react';
import { Fragment, type ReactNode } from 'react';
import { isToolUIPart, getToolName, type UIMessage, type ToolUIPart, type DynamicToolUIPart } from 'ai';
import type { Result, FlightOption, TrainOption, BusOption, HotelOption, WeatherOut, BudgetOut, CabOut, Unavailable as Miss } from '@/lib/types';
import { Flights, Trains, Buses, Hotels, Weather, Cab, Budget, Unavailable } from '../Cards';
import { ToolSkeleton } from './ToolSkeleton';
import { rise } from './anim';

type ToolPart = ToolUIPart | DynamicToolUIPart;
type Found<T> = Extract<Result<T>, { available: true }>;

export const TOOL_TITLE: Record<string, string> = {
  searchFlights: 'Flights', searchTrains: 'Trains', searchBuses: 'Buses', searchHotels: 'Hotels',
  getWeather: 'Weather', getCabHandoff: 'Local ride', estimateBudget: 'Trip budget',
};

const isMiss = (o: unknown): o is Miss => typeof o === 'object' && o !== null && (o as { available?: unknown }).available === false;

/** Tiny safe renderer: **bold** and "- " bullets, no HTML injection. */
function inline(s: string): ReactNode[] {
  return s.split(/(\*\*[^*]+\*\*)/g).map((p, i) => (p.startsWith('**') && p.endsWith('**') ? <strong key={i}>{p.slice(2, -2)}</strong> : <Fragment key={i}>{p}</Fragment>));
}
function Markdown({ text, caret }: { text: string; caret: boolean }) {
  const out: ReactNode[] = [];
  let list: string[] = [];
  const flush = () => { if (list.length) { out.push(<ul key={out.length}>{list.map((l, i) => <li key={i}>{inline(l)}</li>)}</ul>); list = []; } };
  for (const ln of text.split('\n')) {
    const m = ln.match(/^\s*[-•*]\s+(.*)/);
    if (m) list.push(m[1]);
    else { flush(); if (ln.trim()) out.push(<p key={out.length}>{inline(ln.replace(/^#+\s*/, ''))}</p>); }
  }
  flush();
  if (caret && !out.length) out.push(<p key="c" />);
  return <div className={`md${caret ? ' streaming' : ''}`}>{out}</div>;
}

function ToolCard({ part }: { part: ToolPart }) {
  const name = getToolName(part);
  const title = TOOL_TITLE[name] ?? name;
  if (part.state === 'input-streaming' || part.state === 'input-available') return <ToolSkeleton name={name} />;
  if (part.state === 'output-error') return <Unavailable icon={name} title={title} r={{ reason: "This search didn't go through. The agent will work around it." }} />;
  if (part.state !== 'output-available') return null;
  const o: unknown = part.output;
  if (isMiss(o)) return <Unavailable icon={name} title={title} r={o} />;
  switch (name) {
    case 'searchFlights': return <Flights r={o as Found<FlightOption>} />;
    case 'searchTrains': return <Trains r={o as Found<TrainOption>} />;
    case 'searchBuses': return <Buses r={o as Found<BusOption>} />;
    case 'searchHotels': return <Hotels r={o as Found<HotelOption>} />;
    case 'getWeather': return <Weather r={o as WeatherOut} />;
    case 'getCabHandoff': return <Cab r={o as CabOut} />;
    case 'estimateBudget': return <Budget r={o as BudgetOut} />;
    default: return null;
  }
}

export function Message({ message, streaming }: { message: UIMessage; streaming: boolean }) {
  if (message.role === 'user') {
    const text = message.parts.map((p) => (p.type === 'text' ? p.text : '')).join('');
    return <motion.article className="msg user" {...rise}><p className="bubble">{text}</p></motion.article>;
  }

  const visible = message.parts.filter((p) => (p.type === 'text' && p.text.trim()) || isToolUIPart(p));
  const last = visible[visible.length - 1];
  return (
    <motion.article className="msg bot" {...rise}>
      {message.parts.map((p, i) => {
        if (p.type === 'text') {
          if (!p.text.trim()) return null;
          return <Markdown key={i} text={p.text} caret={streaming && p === last} />;
        }
        if (isToolUIPart(p)) {
          const ready = p.state === 'output-available' || p.state === 'output-error';
          return <motion.div key={`${p.toolCallId}:${ready}`} className="tool" {...rise}><ToolCard part={p} /></motion.div>;
        }
        return null;
      })}
    </motion.article>
  );
}

/** Plain-text transcript for "Copy conversation". */
export function transcript(messages: UIMessage[]): string {
  return messages.map((m) => {
    const who = m.role === 'user' ? 'You' : 'VoyageBHARAT';
    const lines: string[] = [];
    for (const p of m.parts) {
      if (p.type === 'text' && p.text.trim()) lines.push(p.text.trim());
      else if (isToolUIPart(p) && p.state === 'output-available') {
        const name = getToolName(p), o: unknown = p.output, title = TOOL_TITLE[name] ?? name;
        if (isMiss(o)) lines.push(`• ${title}: ${o.reason}${o.suggestion ? ` (${o.suggestion})` : ''}`);
        else if (name === 'estimateBudget') { const b = o as BudgetOut; lines.push(`• ${title}: ₹${b.total.toLocaleString('en-IN')} (₹${b.totalWithContingency.toLocaleString('en-IN')} with 10% buffer)`); }
        else if (typeof o === 'object' && o !== null && 'highlights' in o) {
          const f = o as { route: string; date: string; highlights: Record<string, string> };
          lines.push(`• ${title}: ${f.route}, ${f.date}${f.highlights.cheapest ? ` — cheapest ${f.highlights.cheapest}` : ''}`);
        } else if (name === 'getWeather') { const w = o as WeatherOut; lines.push(`• ${title}: ${w.place} ${w.date}, ${w.maxC}°/${w.minC}°C, ${w.summary}`); }
      }
    }
    return `${who}:\n${lines.join('\n')}`;
  }).join('\n\n');
}
