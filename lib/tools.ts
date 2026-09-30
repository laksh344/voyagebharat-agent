import { tool } from 'ai';
import { z } from 'zod';
import { findPlace, km, KNOWN, Place } from './geo';
import { rng, pick, between, round10, demand, hhmm, todayIST, daysAhead } from './sample';
import { flightLink, trainLink, busLink, hotelLink, cabLinks } from './links';
import { liveEnabled, liveFlights, liveHotels, LiveError } from './live';
import type { Result, FlightOption, TrainOption, BusOption, HotelOption, WeatherOut, BudgetOut, CabOut, Meta } from './types';

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).describe('Travel date, YYYY-MM-DD (Indian Standard Time)');
const meta = (note?: string, source: Meta['source'] = 'sample-model'): Meta => ({ source, asOf: new Date().toISOString(), note });
/** Note shown on a modelled card when live pricing was attempted and failed. */
const fallbackNote = (err: unknown) => err instanceof LiveError ? `Live prices unavailable (${err.message}) — showing estimate.` : 'Live prices unavailable — showing estimate.';
const addDays = (d: string, n: number) => new Date(Date.parse(d + 'T00:00:00Z') + n * 86400000).toISOString().slice(0, 10);
const cheapestFastest = <T extends { fare?: number; durationMin?: number; tags: string[] }>(xs: T[], fare: (x: T) => number) => {
  if (!xs.length) return;
  [...xs].sort((a, b) => fare(a) - fare(b))[0].tags.push('cheapest');
  const f = [...xs].sort((a, b) => (a.durationMin ?? 0) - (b.durationMin ?? 0))[0];
  if (!f.tags.includes('cheapest')) f.tags.push('fastest'); else if (xs.length > 1) f.tags.push('fastest');
};
type Ends = { ok: false; err: string } | { ok: true; a: Place; b: Place; d: number };
const endpoints = (from: string, to: string): Ends => {
  const a = findPlace(from), b = findPlace(to);
  if (!a || !b) return { ok: false, err: `I don't have route data for ${!a ? from : to}. Cities I know: ${KNOWN}.` };
  if (a.name === b.name) return { ok: false, err: 'Origin and destination are the same city.' };
  return { ok: true, a, b, d: km(a, b) };
};

/* ---------------------------------- FLIGHTS ---------------------------------- */
export const searchFlights = tool({
  description: 'Search domestic flights between two Indian cities. Returns fares per person, times and booking links. Live Google Flights prices when available, otherwise a labelled estimate.',
  inputSchema: z.object({ from: z.string().describe('Origin city'), to: z.string().describe('Destination city'), date }),
  execute: async ({ from, to, date }): Promise<Result<FlightOption>> => {
    const e = endpoints(from, to); if (!e.ok) return { available: false, reason: e.err };
    const { a, b, d } = e;
    if (!a.iata || !b.iata) {
      const miss = !a.iata ? a : b;
      return { available: false, reason: `${miss.name} has no commercial airport.`, suggestion: miss.nearestAir };
    }
    const route = `${a.name} (${a.iata}) → ${b.name} (${b.iata})`;
    let liveFail: string | undefined;
    if (liveEnabled()) {
      try {
        const { options } = await liveFlights(a.iata, b.iata, date, flightLink(a.iata, b.iata, date));
        if (options.length) {
          cheapestFastest(options, (x) => x.fare);
          return { available: true, route, date, options, ...meta('Live Google Flights fare per person, one way, economy. Prices change; confirm at checkout.', 'live-google-flights'),
            highlights: { cheapest: `₹${options[0].fare.toLocaleString('en-IN')} on ${options[0].airline}`, distanceKm: String(d) } };
        }
        liveFail = 'No live flights found for this date — showing estimate.';
      } catch (err) { liveFail = fallbackNote(err); }
    }
    const r = rng(`F|${a.name}|${b.name}|${date}`), m = demand(date), gc = d / 1.25;
    const carriers: [string, string][] = [['IndiGo', '6E'], ['Air India', 'AI'], ['Akasa Air', 'QP'], ['Air India Express', 'IX'], ['SpiceJet', 'SG']];
    const slots = [5.5, 7, 9.5, 12, 15.5, 18, 21].sort(() => r() - 0.5).slice(0, 5).sort((x, y) => x - y);
    const options: FlightOption[] = slots.map((h, i) => {
      const [name, code] = carriers[(i + Math.floor(r() * 5)) % carriers.length];
      const stops = gc > 900 && r() < 0.3 ? 1 : 0;
      const dur = Math.round((45 + gc / 13) * (stops ? 1.9 : 1) + between(r, -8, 12));
      const start = Math.round(h * 60);
      const fare = round10((1900 + 3.9 * gc) * m * between(r, 0.86, 1.24) * (stops ? 0.82 : 1));
      return { airline: name, flightNo: `${code}-${Math.floor(200 + r() * 700)}`, depart: hhmm(start), arrive: hhmm(start + dur), durationMin: dur, stops, fare, tags: stops ? [] : ['nonstop'], bookUrl: flightLink(a.iata!, b.iata!, date) };
    }).sort((x, y) => x.fare - y.fare);
    cheapestFastest(options, (x) => x.fare);
    return { available: true, route, date, options, ...meta(liveFail ?? 'Fare per person, one way, incl. taxes (modelled).'),
      highlights: { cheapest: `₹${options[0].fare.toLocaleString('en-IN')} on ${options[0].airline}`, distanceKm: String(d) } };
  },
});

/* ----------------------------------- TRAINS ----------------------------------- */
export const searchTrains = tool({
  description: 'Search Indian Railways trains between two cities with per-class fare and seat availability. Availability is an indicative snapshot; IRCTC is the source of truth at booking.',
  inputSchema: z.object({ from: z.string(), to: z.string(), date }),
  execute: async ({ from, to, date }): Promise<Result<TrainOption>> => {
    const e = endpoints(from, to); if (!e.ok) return { available: false, reason: e.err };
    const { a, b, d } = e;
    if (!a.rail || !b.rail) {
      const miss = !a.rail ? a : b;
      return { available: false, reason: `${miss.name} has no railway station.`, suggestion: miss.nearestRail };
    }
    const r = rng(`T|${a.name}|${b.name}|${date}`), m = demand(date);
    const kinds: [string, number, number][] = d <= 900 ? [['Vande Bharat Express', 78, 1.3], ['Shatabdi Express', 72, 1.25], ['Superfast Express', 55, 1], ['Intercity Express', 44, 0.95]]
                : d <= 1400 ? [['Rajdhani Express', 68, 1.3], ['Duronto Express', 63, 1.2], ['Superfast Express', 54, 1], ['Garib Rath', 50, 0.85]]
                : [['Rajdhani Express', 66, 1.3], ['Duronto Express', 60, 1.2], ['Superfast Express', 52, 1], ['Humsafar Express', 55, 1.05]];
    const options: TrainOption[] = kinds.map(([rawName, kph, prem], i) => {
      const name = rawName === 'Intercity Express' && d > 300 ? 'Mail Express' : rawName; // intercity trains are short-haul
      const premium = prem > 1.2;
      const dur = Math.round((d / kph) * 60 + between(r, 10, 40));
      // Vande Bharat / Shatabdi are daytime trains; overnight slots only for sleeper services
      const dayTrain = name.startsWith('Vande Bharat') || name.startsWith('Shatabdi');
      const start = Math.round(pick(r, dayTrain ? [5.25, 6, 6.5, 14.25, 15] : [5.25, 6, 8.5, 14.25, 16.5, 19.5, 21.75]) * 60);
      const sl = Math.max(165, round10(0.43 * d * prem));
      const rows: [string, number][] = premium && d <= 900 ? [['CC', 3.4], ['EC', 6.4]] : [['SL', 1], ['3A', 2.7], ['2A', 3.9]];
      const classes = rows.map(([cls, mult]) => {
        const p = r() / m; // higher demand => worse availability
        const availability = p > 0.55 ? `AVAILABLE-${Math.floor(4 + r() * 90)}` : p > 0.3 ? `RAC ${Math.floor(1 + r() * 20)}` : `WL ${Math.floor(3 + r() * 60)}`;
        return { cls, availability, fare: round10(sl * mult), bookUrl: trainLink(a.rail!, b.rail!, date, cls) };
      });
      return { number: String(12000 + Math.floor(r() * 9000) + i), name, depart: hhmm(start), arrive: hhmm(start + dur), durationMin: dur, classes, tags: [] };
    });
    options.sort((x, y) => Math.min(...x.classes.map((c) => c.fare)) - Math.min(...y.classes.map((c) => c.fare)));
    cheapestFastest(options as any, (x: any) => Math.min(...x.classes.map((c: any) => c.fare)));
    const cheapest = options[0], best = cheapest.classes.reduce((p, c) => (c.fare < p.fare ? c : p));
    return { available: true, route: `${a.name} (${a.rail}) → ${b.name} (${b.rail})`, date, options, ...meta('Estimated fares and availability — check live seats before booking.'), liveCheckUrl: trainLink(a.rail!, b.rail!, date),
      highlights: { cheapest: `₹${best.fare.toLocaleString('en-IN')} (${best.cls}) on ${cheapest.name}`, distanceKm: String(d) } };
  },
});

/* ------------------------------------ BUSES ------------------------------------ */
export const searchBuses = tool({
  description: 'Search inter-city buses between two Indian cities. Returns fares, times, seats left and booking links.',
  inputSchema: z.object({ from: z.string(), to: z.string(), date }),
  execute: async ({ from, to, date }): Promise<Result<BusOption>> => {
    const e = endpoints(from, to); if (!e.ok) return { available: false, reason: e.err };
    const { a, b, d } = e;
    if (d > 1500) return { available: false, reason: `${d} km is too far for a comfortable bus journey.`, suggestion: 'Prefer a train or flight for this distance.' };
    const r = rng(`B|${a.name}|${b.name}|${date}`), m = demand(date);
    const ops = ['Orange Travels', 'VRL Travels', 'SRS Travels', 'KPN Travels', 'IntrCity SmartBus', 'Neeta Travels'].sort(() => r() - 0.5);
    const types: [string, number, number][] = [['AC Sleeper (2+1)', 1.3, 47], ['Non-AC Seater', 0.8, 44], ['Volvo Multi-Axle AC', 1.6, 52], ['AC Seater/Sleeper', 1.1, 48]];
    const options: BusOption[] = types.map(([type, rate, kph], i) => {
      const dur = Math.round((d / kph) * 60 + between(r, 15, 50));
      const start = Math.round((d > 400 ? pick(r, [18, 19.5, 21, 22]) : pick(r, [6, 9, 14, 18])) * 60);
      return { operator: ops[i], type, depart: hhmm(start), arrive: hhmm(start + dur), durationMin: dur, seatsLeft: Math.floor(2 + r() * 28),
        fare: Math.max(250, round10(rate * d * m * between(r, 0.9, 1.15))), tags: [], bookUrl: busLink(a.name, b.name, date) };
    }).sort((x, y) => x.fare - y.fare);
    cheapestFastest(options, (x) => x.fare);
    return { available: true, route: `${a.name} → ${b.name}`, date, options, ...meta('Estimated fare per seat — check live seats before booking.'), liveCheckUrl: busLink(a.name, b.name, date), highlights: { cheapest: `₹${options[0].fare.toLocaleString('en-IN')} on ${options[0].operator}`, distanceKm: String(d) } };
  },
});

/* ------------------------------------ HOTELS ------------------------------------ */
export const searchHotels = tool({
  description: 'Search hotels in an Indian city for a stay. Prices are per room per night. Optionally cap the nightly price. Live Google Hotels prices when available, otherwise a labelled estimate.',
  inputSchema: z.object({ city: z.string(), checkin: date, nights: z.number().int().min(1).max(30), guests: z.number().int().min(1).max(8).optional().describe('Adults sharing the room; default 2'), maxPricePerNight: z.number().optional().describe('INR cap per night') }),
  execute: async ({ city, checkin, nights, guests, maxPricePerNight }): Promise<Result<HotelOption>> => {
    const p: Place = findPlace(city) ?? { name: city, lat: 0, lng: 0, costIndex: 1, areas: ['City Centre', 'Near Station', 'Old Town', 'Airport Road', 'Riverside'] };
    const out0 = addDays(checkin, nights), label = `${p.name} · ${nights} night${nights > 1 ? 's' : ''}`;
    let liveFail: string | undefined;
    if (liveEnabled()) {
      try {
        const { options } = await liveHotels(p.name, checkin, out0, guests ?? 2, maxPricePerNight, hotelLink(p.name, checkin, out0));
        if (options.length) {
          options[0].tags.push('cheapest');
          const best = [...options].filter((o) => o.rating).sort((x, y) => y.rating - x.rating)[0];
          if (best) best.tags.push('top_rated');
          options.forEach((o) => o.freeCancellation && o.tags.push('free_cancellation'));
          return { available: true, route: label, date: `${checkin} → ${out0}`, options, ...meta('Live Google Hotels rate per room per night. Prices change; confirm at checkout.', 'live-google-hotels'),
            highlights: { cheapest: `₹${options[0].pricePerNight.toLocaleString('en-IN')}/night at ${options[0].name}`, nights: String(nights) } };
        }
        if (maxPricePerNight) return { available: false, reason: `No live hotel rates under ₹${maxPricePerNight.toLocaleString('en-IN')}/night in ${p.name} for these dates.`, suggestion: 'Try a higher cap or different dates.' };
        liveFail = 'No live hotel rates found — showing estimate.';
      } catch (err) { liveFail = fallbackNote(err); }
    }
    const r = rng(`H|${p.name}|${checkin}`), m = demand(checkin), out = addDays(checkin, nights);
    const adj = ['Grand', 'Royal', 'Lakeview', 'Palm Grove', 'Heritage', 'Urban', 'Sunrise', 'Coral', 'Amber', 'Blue Lagoon'].sort(() => r() - 0.5);
    const noun = ['Residency', 'Inn', 'Suites', 'Retreat', 'Stay', 'Resort', 'Haveli', 'Homestay'];
    const tiers: [number, number, number][] = [[1, 1100, 1900], [2, 1700, 2800], [3, 2700, 4300], [3, 3200, 5200], [4, 5200, 8200], [5, 8500, 14000]];
    let options: HotelOption[] = tiers.map(([stars, lo, hi], i) => ({
      name: `${adj[i]} ${pick(r, noun)}`, area: p.areas[i % p.areas.length], stars, rating: Math.round(between(r, 3.8, 4.7) * 10) / 10,
      pricePerNight: round10(between(r, lo, hi) * p.costIndex * m), freeCancellation: r() > 0.4, tags: [], bookUrl: hotelLink(p.name, checkin, out),
    })).sort((x, y) => x.pricePerNight - y.pricePerNight);
    if (maxPricePerNight) options = options.filter((h) => h.pricePerNight <= maxPricePerNight);
    if (!options.length) return { available: false, reason: `No hotels under ₹${maxPricePerNight?.toLocaleString('en-IN')}/night in ${p.name} for these dates.`, suggestion: 'Try a higher cap or different dates.' };
    options[0].tags.push('cheapest');
    [...options].sort((x, y) => y.rating - x.rating)[0].tags.push('top_rated');
    options.forEach((o) => o.freeCancellation && o.tags.push('free_cancellation'));
    return { available: true, route: `${p.name} · ${nights} night${nights > 1 ? 's' : ''}`, date: `${checkin} → ${out}`, options, ...meta(liveFail ?? 'Price per room per night (modelled).'),
      highlights: { cheapest: `₹${options[0].pricePerNight.toLocaleString('en-IN')}/night at ${options[0].name}`, nights: String(nights) } };
  },
});

/* ------------------------------------ WEATHER ------------------------------------ */
const WMO: Record<number, string> = { 0: 'Clear', 1: 'Mostly clear', 2: 'Partly cloudy', 3: 'Overcast', 45: 'Fog', 51: 'Drizzle', 53: 'Drizzle', 55: 'Drizzle', 61: 'Light rain', 63: 'Rain', 65: 'Heavy rain', 71: 'Snow', 73: 'Snow', 75: 'Heavy snow', 80: 'Showers', 81: 'Showers', 82: 'Heavy showers', 95: 'Thunderstorm', 96: 'Thunderstorm', 99: 'Thunderstorm' };
const HILLS = ['Manali', 'Shimla', 'Ooty', 'Munnar', 'Darjeeling', 'Leh', 'Srinagar', 'Rishikesh'];
function seasonal(city: string, date: string): WeatherOut {
  const month = new Date(date + 'T00:00:00Z').getUTCMonth();
  const base = [27, 30, 34, 37, 38, 35, 31, 30, 31, 32, 30, 27][month] - (HILLS.includes(city) ? 11 : 0);
  const monsoon = month >= 5 && month <= 8;
  return { place: city, date, minC: base - 9, maxC: base, summary: monsoon ? 'Monsoon showers likely' : 'Mostly dry', rainChancePct: monsoon ? 65 : 10,
    meta: { source: 'seasonal-estimate', asOf: new Date().toISOString(), note: 'Typical conditions for this month, not a forecast.' } };
}
const num = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
/** Pulls one day out of an Open-Meteo daily response. Returns undefined when the day is missing or only partly filled
 *  (the last day of the 16-day window often has null temps/codes), so the caller falls back to the labelled estimate. */
export function parseForecast(f: any, place: string, date: string): WeatherOut | undefined {
  const d = f?.daily, i = d?.time?.indexOf?.(date) ?? -1;
  if (i < 0) return;
  const min = d.temperature_2m_min?.[i], max = d.temperature_2m_max?.[i], code = d.weather_code?.[i], rain = d.precipitation_probability_max?.[i];
  if (!num(min) || !num(max) || !num(code)) return;
  return { place, date, minC: Math.round(min), maxC: Math.round(max), summary: WMO[code] ?? 'Mixed', ...(num(rain) ? { rainChancePct: rain } : {}),
    meta: { source: 'open-meteo', asOf: new Date().toISOString(), note: 'Live forecast (Open-Meteo).' } };
}
export const getWeather = tool({
  description: 'Get the weather for a place on a date. Uses a live forecast for the next ~16 days, otherwise a typical-season estimate (labelled).',
  inputSchema: z.object({ city: z.string(), date }),
  execute: async ({ city, date }): Promise<WeatherOut> => {
    const known = findPlace(city);
    try {
      if (daysAhead(date) > 15 || daysAhead(date) < 0) return seasonal(city, date);
      let lat = known?.lat, lng = known?.lng;
      if (lat == null) {
        const g = await (await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1`, { signal: AbortSignal.timeout(5000) })).json();
        if (!g.results?.length) return seasonal(city, date);
        lat = g.results[0].latitude; lng = g.results[0].longitude;
      }
      const f = await (await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&daily=temperature_2m_max,temperature_2m_min,weather_code,precipitation_probability_max&timezone=Asia%2FKolkata&forecast_days=16`, { signal: AbortSignal.timeout(5000) })).json();
      return parseForecast(f, known?.name ?? city, date) ?? seasonal(city, date);
    } catch { return seasonal(city, date); }
  },
});

/* ------------------------------------- CABS ------------------------------------- */
export const getCabHandoff = tool({
  description: 'Get Uber/Ola/Rapido deep links plus an indicative fare range for a first/last-mile ride. Handoff only — nothing is booked here.',
  inputSchema: z.object({ pickup: z.string(), dropoff: z.string(), kind: z.enum(['airport', 'station', 'local']).describe('airport transfer, railway/bus station transfer, or a local sightseeing hop') }),
  execute: async ({ pickup, dropoff, kind }): Promise<CabOut> => {
    const range = { airport: { low: 450, high: 950 }, station: { low: 150, high: 380 }, local: { low: 120, high: 330 } }[kind];
    return { pickup, dropoff, indicativeFareInr: range, ...cabLinks(pickup, dropoff), note: 'Indicative range only. Live fare appears in the cab app when you tap through.' };
  },
});

/* ------------------------------------ BUDGET ------------------------------------ */
export const estimateBudget = tool({
  description: 'Deterministic trip-cost calculator. ALWAYS use this for totals instead of adding numbers yourself. Pass every cost line already multiplied for quantity (travelers, nights, days).',
  inputSchema: z.object({
    lines: z.array(z.object({ label: z.string(), amount: z.number().nonnegative().describe('Total INR for this line'), category: z.enum(['transport', 'stay', 'local', 'food', 'activities', 'other']) })).min(1),
    travelers: z.number().int().min(1).default(1),
    budget: z.number().optional().describe("User's stated budget in INR, if any"),
  }),
  execute: async ({ lines, travelers, budget }): Promise<BudgetOut> => {
    const byCategory: Record<string, number> = {};
    for (const l of lines) byCategory[l.category] = (byCategory[l.category] ?? 0) + Math.round(l.amount);
    const total = Object.values(byCategory).reduce((s, x) => s + x, 0);
    const contingency = Math.round(total * 0.1);
    const totalWithContingency = total + contingency;
    return { currency: 'INR', lines: lines.map((l) => ({ ...l, amount: Math.round(l.amount) })), byCategory, total, perPerson: Math.round(total / travelers), contingency, totalWithContingency, travelers,
      ...(budget != null ? { budget, withinBudget: totalWithContingency <= budget, remaining: budget - totalWithContingency } : {}) };
  },
});

export const tools = { searchFlights, searchTrains, searchBuses, searchHotels, getWeather, getCabHandoff, estimateBudget };
export { todayIST };
