/** Live prices via SerpApi (Google Flights + Google Hotels).
 *  - Only active when SERPAPI_KEY is set; otherwise tools use the modelled estimates.
 *  - 30-minute in-memory cache + in-flight de-duplication, so repeat searches don't burn the
 *    free quota (250 searches/month). The cache is per server instance.
 *  - Throws LiveError on any failure; callers fall back to estimates and label them. */
import type { FlightOption, HotelOption } from './types';

const ENDPOINT = 'https://serpapi.com/search.json';
const TTL_MS = 30 * 60 * 1000;
const cache = new Map<string, { at: number; data: any }>();
const inflight = new Map<string, Promise<any>>();

export class LiveError extends Error {}
export const liveEnabled = () => Boolean(process.env.SERPAPI_KEY);

async function serpapi(params: Record<string, string | number>): Promise<{ data: any; cached: boolean }> {
  const key = process.env.SERPAPI_KEY;
  if (!key) throw new LiveError('live prices not configured');
  const ck = JSON.stringify(params);
  const hit = cache.get(ck);
  if (hit && Date.now() - hit.at < TTL_MS) return { data: hit.data, cached: true };
  if (!inflight.has(ck)) {
    inflight.set(ck, (async () => {
      const qs = new URLSearchParams({ ...Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)])), api_key: key });
      let res: Response;
      try { res = await fetch(`${ENDPOINT}?${qs}`, { signal: AbortSignal.timeout(15000) }); }
      catch { throw new LiveError('live price service did not respond'); }
      let body: any = null;
      try { body = await res.json(); } catch { /* non-JSON */ }
      if (res.status === 429) throw new LiveError('live price quota reached');
      if (!res.ok || body?.error) throw new LiveError(String(body?.error ?? `live price service error ${res.status}`).replace(key, '***'));
      cache.set(ck, { at: Date.now(), data: body });
      return body;
    })().finally(() => inflight.delete(ck)));
  }
  return { data: await inflight.get(ck)!, cached: false };
}

const hhmm = (t?: string) => (t && /\d{2}:\d{2}$/.test(t) ? t.slice(-5) : '');
const day = (t?: string) => (t ?? '').slice(0, 10);

/** One-way economy fares for 1 adult, in INR. */
export async function liveFlights(from: string, to: string, date: string, fallbackLink: string) {
  const { data, cached } = await serpapi({ engine: 'google_flights', departure_id: from, arrival_id: to, outbound_date: date, type: 2, adults: 1, currency: 'INR', gl: 'in', hl: 'en' });
  const link: string = data?.search_metadata?.google_flights_url ?? fallbackLink;
  const seen = new Set<string>();
  const options: FlightOption[] = [];
  for (const it of [...(data?.best_flights ?? []), ...(data?.other_flights ?? [])]) {
    const legs: any[] = it?.flights ?? [];
    if (!legs.length || typeof it?.price !== 'number') continue;
    const first = legs[0], last = legs[legs.length - 1];
    const flightNo = legs.map((l) => l.flight_number).filter(Boolean).join(' / ');
    const depart = hhmm(first?.departure_airport?.time), arrive = hhmm(last?.arrival_airport?.time);
    if (!depart || !arrive) continue;
    const dedupe = `${flightNo}|${depart}`;
    if (seen.has(dedupe)) continue;
    seen.add(dedupe);
    const nextDay = day(last?.arrival_airport?.time) > day(first?.departure_airport?.time);
    options.push({
      airline: [...new Set(legs.map((l) => l.airline).filter(Boolean))].join(' + '),
      flightNo, depart, arrive: nextDay ? `${arrive} +1` : arrive,
      durationMin: Number(it.total_duration) || legs.reduce((s, l) => s + (Number(l.duration) || 0), 0),
      stops: legs.length - 1, fare: Math.round(it.price), tags: legs.length === 1 ? ['nonstop'] : [], bookUrl: link,
    });
  }
  options.sort((a, b) => a.fare - b.fare);
  return { options: options.slice(0, 6), cached };
}

/** Nightly room rates in INR. */
export async function liveHotels(city: string, checkin: string, checkout: string, guests: number, maxPricePerNight: number | undefined, fallbackLink: string) {
  const params: Record<string, string | number> = { engine: 'google_hotels', q: `hotels in ${city}, India`, check_in_date: checkin, check_out_date: checkout, adults: guests, currency: 'INR', gl: 'in', hl: 'en', sort_by: 3 };
  if (maxPricePerNight) params.max_price = Math.round(maxPricePerNight);
  const { data, cached } = await serpapi(params);
  const link: string = data?.search_metadata?.google_hotels_url ?? fallbackLink;
  const options: HotelOption[] = [];
  for (const p of data?.properties ?? []) {
    const price = Number(p?.rate_per_night?.extracted_lowest);
    if (!p?.name || !price) continue;
    if (maxPricePerNight && price > maxPricePerNight) continue;
    options.push({
      name: String(p.name), area: city,
      stars: Number(p.extracted_hotel_class) || 0,
      rating: typeof p.overall_rating === 'number' ? p.overall_rating : 0,
      pricePerNight: Math.round(price),
      freeCancellation: typeof p.free_cancellation === 'boolean' ? p.free_cancellation : undefined,
      tags: [], bookUrl: typeof p.link === 'string' && p.link.startsWith('http') ? p.link : link,
    });
  }
  options.sort((a, b) => a.pricePerNight - b.pricePerNight);
  return { options: options.slice(0, 6), cached };
}

export const _test = { clearCache: () => cache.clear() };
