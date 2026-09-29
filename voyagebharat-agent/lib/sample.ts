/** Deterministic, distance-based travel model. NOT live inventory — every result is tagged
 *  `sample-model`. Seeded by route+date, so results are stable and differ per route.
 *  Swap `lib/tools.ts` to call real providers (Amadeus, redBus, Booking...) without touching the agent. */
import { Place } from './geo';

export function rng(seed: string) {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) { h = Math.imul(h ^ seed.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); }
  let a = h >>> 0;
  return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
export const pick = <T,>(r: () => number, xs: T[]) => xs[Math.floor(r() * xs.length)];
export const between = (r: () => number, lo: number, hi: number) => lo + r() * (hi - lo);
export const round10 = (n: number) => Math.round(n / 10) * 10;

const IST = 'Asia/Kolkata';
export const todayIST = () => new Intl.DateTimeFormat('en-CA', { timeZone: IST }).format(new Date());
export const daysAhead = (date: string) => Math.round((Date.parse(date + 'T00:00:00Z') - Date.parse(todayIST() + 'T00:00:00Z')) / 86400000);
export const isWeekend = (date: string) => [5, 6, 0].includes(new Date(date + 'T00:00:00Z').getUTCDay());

/** demand multiplier: last-minute is dearer, far-ahead is cheaper, weekends carry a premium */
export function demand(date: string) {
  const d = daysAhead(date);
  let m = d < 0 ? 1 : d <= 2 ? 1.4 : d <= 7 ? 1.18 : d <= 30 ? 1 : 0.9;
  if (isWeekend(date)) m *= 1.08;
  return m;
}

export const hhmm = (mins: number) => `${String(Math.floor(mins / 60) % 24).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;
export const addMin = (start: number, dur: number) => hhmm(start + dur);
export const fmtDur = (m: number) => `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m`;

export function stateOf(a: Place, b: Place) { return `${a.name}→${b.name}`; }
