/** Resolves any Indian city or town to a Place, not just the curated table in geo.ts.
 *  1. Curated table (hand-picked hubs, areas, cost index).
 *  2. Open-Meteo geocoding (free, no key), India only, optional "City, State" hint.
 *  3. Offline fallback: match the name against railway stations / airport cities.
 *  The airport and railway hub then come from the nearest entries in lib/data (regenerate
 *  with `npm run data:geo`). Results are cached per server instance. */
import { findPlace, PLACES, type Place } from './geo';
import AIRPORTS from './data/airports-in.json';
import STATIONS from './data/stations-in.json';

type Airport = [iata: string, name: string, city: string, lat: number, lng: number];
type Station = [code: string, name: string, lat: number, lng: number];
const airports = AIRPORTS as Airport[], stations = STATIONS as Station[];

const AIR_KM = 35;          // an airport this close (straight line) counts as the city's own
const RAIL_KM = 25;         // same for a railway station
const HINT_KM = 250;        // beyond this, don't suggest a "nearest" hub
const DEFAULT_AREAS = ['City Centre', 'Near Station', 'Old Town', 'Airport Road', 'Main Market'];

const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '');
const norm = (s: string) => fold(s).toLowerCase().replace(/[^a-z ]/g, ' ').replace(/\s+/g, ' ').trim();
const title = (s: string) => fold(s).toLowerCase().replace(/\b[a-z]/g, (c) => c.toUpperCase());

function straightKm(aLat: number, aLng: number, bLat: number, bLng: number) {
  const r = Math.PI / 180, dLat = (bLat - aLat) * r, dLng = (bLng - aLng) * r;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(aLat * r) * Math.cos(bLat * r) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}
const road = (k: number) => Math.round((k * 1.25) / 5) * 5;   // same 25% detour factor as geo.km

function nearestAirport(lat: number, lng: number) {
  let best: Airport | undefined, bk = Infinity;
  for (const a of airports) { const k = straightKm(lat, lng, a[3], a[4]); if (k < bk) { bk = k; best = a; } }
  return best && { iata: best[0], city: best[2] || best[1], km: bk };
}

const JUNCTION = /\b(jn|junction|central|term|terminus)\b/;
const MINOR = /\b(halt|hlt|h|ng)$|\(ng\)/i;                  // halts and narrow-gauge duplicates
const HUBS = new Set([...PLACES.map((p) => p.rail).filter(Boolean), 'NJP']);

/** The station a traveller would actually use: close, named after the town, a junction over a halt.
 *  With none in town, suggest a hub worth travelling to rather than the nearest halt. */
function mainStation(name: string, lat: number, lng: number) {
  const n = norm(name);
  let best: Station | undefined, bs = Infinity, hint: Station | undefined, hs = Infinity, hk = 0;
  for (const s of stations) {
    const k = straightKm(lat, lng, s[2], s[3]);
    if (k > HINT_KM) continue;
    const sn = norm(s[1]), minor = MINOR.test(s[1]) ? 1 : 0, jn = JUNCTION.test(sn) ? 1 : 0;
    const h = k - (HUBS.has(s[0]) ? 60 : 0) - jn * 25 + minor * 40;
    if (h < hs) { hs = h; hint = s; hk = k; }
    if (k > RAIL_KM) continue;
    const score = k - (sn === n || sn.startsWith(n + ' ') ? 20 : 0) - jn * 6 + minor * 15;
    if (score < bs) { bs = score; best = s; }
  }
  return { best, nearest: hint && { code: hint[0], name: title(hint[1]), km: hk } };
}

function build(name: string, lat: number, lng: number): Place {
  const air = nearestAirport(lat, lng), rail = mainStation(name, lat, lng);
  const p: Place = { name, lat, lng, costIndex: 1, areas: DEFAULT_AREAS };
  if (air && air.km <= AIR_KM) p.iata = air.iata;
  else if (air && air.km <= HINT_KM) p.nearestAir = `${air.city} (${air.iata}), ~${road(air.km)} km by road`;
  else p.nearestAir = 'No airport nearby';
  if (rail.best) p.rail = rail.best[0];
  else if (rail.nearest && rail.nearest.km <= HINT_KM) p.nearestRail = `${rail.nearest.name} (${rail.nearest.code}), ~${road(rail.nearest.km)} km by road`;
  else p.nearestRail = 'No railway station nearby';
  return p;
}

async function geocode(name: string, state?: string): Promise<{ name: string; lat: number; lng: number } | null | undefined> {
  const url = `https://geocoding-api.open-meteo.com/v1/search?${new URLSearchParams({ name, count: '10', language: 'en', countryCode: 'IN' })}`;
  let body: any;
  try { body = await (await fetch(url, { signal: AbortSignal.timeout(5000) })).json(); }
  catch { return undefined; }                       // network failure: caller tries the offline fallback
  const hits: any[] = (body?.results ?? []).filter((r: any) => r.country_code === 'IN' && String(r.feature_code ?? '').startsWith('PPL'));
  const inState = state ? hits.filter((r) => norm(r.admin1 ?? '').includes(norm(state))) : hits;
  const pool = inState.length ? inState : hits;
  const exact = pool.filter((r) => norm(r.name) === norm(name));
  const hit = (exact.length ? exact : pool).sort((a, b) => (b.population ?? 0) - (a.population ?? 0))[0];
  return hit ? { name: title(hit.name), lat: hit.latitude, lng: hit.longitude } : null;
}

function offline(name: string) {
  const n = norm(name);
  const st = stations.find((s) => [n, `${n} jn`, `${n} junction`, `${n} central`, `${n} city`, `${n} cantt`].includes(norm(s[1])));
  if (st) return { name: title(name), lat: st[2], lng: st[3] };
  const ap = airports.find((a) => norm(a[2]) === n);
  return ap ? { name: title(name), lat: ap[3], lng: ap[4] } : undefined;
}

const cache = new Map<string, Place | null>();

export async function resolvePlace(input: string): Promise<Place | undefined> {
  const curated = findPlace(input);
  if (curated) return curated;
  const [rawName, state] = input.split(',').map((s) => s.trim());
  if (!rawName || norm(rawName).length < 2) return undefined;
  const key = `${norm(rawName)}|${norm(state ?? '')}`;
  if (cache.has(key)) return cache.get(key) ?? undefined;
  const g = await geocode(rawName, state);
  const hit = g ?? offline(rawName);                     // offline also catches old names the geocoder lacks (Alleppey)
  const place = hit ? (findPlace(hit.name) ?? build(hit.name, hit.lat, hit.lng)) : null;
  if (g !== undefined || place) cache.set(key, place);   // don't cache a network failure with no fallback
  return place ?? undefined;
}
