/** Live-price path with a fake SerpApi (no key, no quota): `npm run smoke:live` */
import { tools } from '../lib/tools';
import { _test } from '../lib/live';
const run = (t: any, input: any) => t.execute(input, { toolCallId: 't', messages: [] });
const ok = (c: boolean, m: string) => { console.log(`${c ? '  PASS' : '  FAIL'}  ${m}`); if (!c) process.exitCode = 1; };
const date = (n: number) => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);
const KEY = 'test_secret_key_123';

const leg = (no: string, airline: string, dep: string, arr: string, dur: number, from = 'HYD', to = 'GOI') =>
  ({ departure_airport: { id: from, time: dep }, arrival_airport: { id: to, time: arr }, duration: dur, airline, flight_number: no });
const flightsFixture = (d: string) => ({
  search_metadata: { google_flights_url: 'https://www.google.com/travel/flights?test=1' },
  best_flights: [
    { flights: [leg('6E 511', 'IndiGo', `${d} 06:10`, `${d} 07:35`, 85)], total_duration: 85, price: 4312 },
    { flights: [leg('AI 2811', 'Air India', `${d} 22:40`, `${d} 23:55`, 75)], total_duration: 75, price: 5120 },
  ],
  other_flights: [
    { flights: [leg('QP 1102', 'Akasa Air', `${d} 21:00`, `${d} 22:20`, 80, 'HYD', 'BOM'), leg('QP 1340', 'Akasa Air', `${d} 23:30`, `${date(15)} 00:40`, 70, 'BOM', 'GOI')], total_duration: 220, price: 3899 },
    { flights: [leg('6E 511', 'IndiGo', `${d} 06:10`, `${d} 07:35`, 85)], total_duration: 85, price: 4312 }, // duplicate
    { flights: [leg('SG 999', 'SpiceJet', `${d} 12:00`, `${d} 13:20`, 80)], total_duration: 80 }, // no price → dropped
  ],
});
const hotelsFixture = {
  search_metadata: { google_hotels_url: 'https://www.google.com/travel/hotels?test=1' },
  properties: [
    { name: 'Sea Breeze Inn', rate_per_night: { extracted_lowest: 2450 }, extracted_hotel_class: 3, overall_rating: 4.2, link: 'https://seabreeze.example' },
    { name: 'Palm Hostel', rate_per_night: { extracted_lowest: 900 }, overall_rating: 4.6 },
    { name: 'Grand Luxe', rate_per_night: { extracted_lowest: 14000 }, extracted_hotel_class: 5, overall_rating: 4.8, free_cancellation: true },
    { name: 'No Price Villa' },
  ],
};

let calls = 0, lastUrl = '';
type Mode = 'ok' | 'quota' | 'error-json' | 'network' | 'empty';
let mode: Mode = 'ok';
const d = date(14);
(globalThis as any).fetch = async (url: string) => {
  calls++; lastUrl = String(url);
  if (mode === 'network') throw new TypeError('fetch failed');
  if (mode === 'quota') return new Response(JSON.stringify({ error: 'Your account has run out of searches.' }), { status: 429 });
  if (mode === 'error-json') return new Response(JSON.stringify({ error: `Invalid API key ${KEY}` }), { status: 401 });
  const engine = new URL(url).searchParams.get('engine');
  const body = mode === 'empty' ? { search_metadata: {} } : engine === 'google_flights' ? flightsFixture(d) : hotelsFixture;
  return new Response(JSON.stringify(body), { status: 200 });
};

(async () => {
  console.log('\n[1] No key → modelled estimates, no network');
  delete process.env.SERPAPI_KEY;
  const m: any = await run(tools.searchFlights, { from: 'Hyderabad', to: 'Goa', date: d });
  ok(m.available && m.source === 'sample-model' && calls === 0, 'flights fall back to estimate without calling SerpApi');

  process.env.SERPAPI_KEY = KEY;
  console.log('\n[2] Live flights');
  const f: any = await run(tools.searchFlights, { from: 'Hyderabad', to: 'Goa', date: d });
  const q = new URL(lastUrl).searchParams;
  ok(q.get('engine') === 'google_flights' && q.get('type') === '2' && q.get('currency') === 'INR' && q.get('gl') === 'in' && q.get('outbound_date') === d, 'request: one-way, INR, India locale, correct date');
  ok(f.source === 'live-google-flights', `labelled live (${f.source})`);
  ok(f.options.length === 3, `priceless + duplicate itineraries dropped (${f.options.length} kept)`);
  ok(f.options[0].fare === 3899 && f.options.every((o: any, i: number, a: any[]) => !i || a[i - 1].fare <= o.fare), 'sorted cheapest-first');
  const conn = f.options.find((o: any) => o.stops === 1);
  ok(conn?.flightNo === 'QP 1102 / QP 1340' && conn.arrive === '00:40 +1' && conn.durationMin === 220, `connection mapped: ${conn?.flightNo}, arrives ${conn?.arrive}`);
  ok(f.options.some((o: any) => o.tags.includes('cheapest')) && f.options.some((o: any) => o.tags.includes('fastest')), 'cheapest + fastest tagged');
  ok(f.options[0].bookUrl.startsWith('https://www.google.com/travel/flights'), 'book link opens the same Google Flights search');

  console.log('\n[3] Cache');
  const before = calls;
  await run(tools.searchFlights, { from: 'Hyderabad', to: 'Goa', date: d });
  ok(calls === before, 'repeat search served from cache (no quota used)');
  await Promise.all([run(tools.searchHotels, { city: 'Goa', checkin: d, nights: 2 }), run(tools.searchHotels, { city: 'Goa', checkin: d, nights: 2 })]);
  ok(calls === before + 1, 'two identical searches at once → one SerpApi call');

  console.log('\n[4] Live hotels');
  const h: any = await run(tools.searchHotels, { city: 'Goa', checkin: d, nights: 2 });
  ok(h.source === 'live-google-hotels' && h.options.length === 3, `labelled live, priceless property dropped (${h.options.length})`);
  ok(h.options[0].name === 'Palm Hostel' && h.options[0].tags.includes('cheapest'), 'cheapest first');
  ok(h.options.find((o: any) => o.name === 'Grand Luxe').tags.includes('top_rated'), 'top rated tagged');
  ok(h.options.find((o: any) => o.name === 'Sea Breeze Inn').freeCancellation === undefined, 'unknown cancellation policy stays unknown (no false "non-refundable")');
  ok(h.options.find((o: any) => o.name === 'Sea Breeze Inn').bookUrl === 'https://seabreeze.example', 'hotel website link used when present');
  const hc: any = await run(tools.searchHotels, { city: 'Goa', checkin: date(20), nights: 1, maxPricePerNight: 3000 });
  ok(new URL(lastUrl).searchParams.get('max_price') === '3000' && hc.options.every((o: any) => o.pricePerNight <= 3000), 'price cap sent and enforced');
  const hx: any = await run(tools.searchHotels, { city: 'Goa', checkin: date(21), nights: 1, maxPricePerNight: 500 });
  ok(!hx.available && /No live hotel rates under/.test(hx.reason), 'impossible cap → clear miss, not a fake estimate');

  console.log('\n[5] Failures fall back, labelled');
  _test.clearCache();
  for (const [md, re] of [['quota', /quota reached/], ['network', /did not respond/], ['error-json', /Invalid API key \*\*\*/], ['empty', /No live flights found/]] as [Mode, RegExp][]) {
    mode = md; _test.clearCache();
    const r: any = await run(tools.searchFlights, { from: 'Hyderabad', to: 'Goa', date: d });
    ok(r.available && r.source === 'sample-model' && re.test(r.note), `${md}: estimate shown, note "${r.note}"`);
  }
  mode = 'ok';

  console.log('\n[6] Trains/buses stay estimates with a live-seat link; key never leaks');
  const t: any = await run(tools.searchTrains, { from: 'Hyderabad', to: 'Goa', date: d });
  const b: any = await run(tools.searchBuses, { from: 'Hyderabad', to: 'Goa', date: d });
  ok(t.source === 'sample-model' && t.liveCheckUrl.startsWith('https://www.ixigo.com/') && !t.liveCheckUrl.includes('class='), 'train card links to live seat search');
  ok(b.source === 'sample-model' && b.liveCheckUrl.startsWith('https://www.redbus.in/'), 'bus card links to live seat search');
  const all = JSON.stringify([f, h, hc, t, b]);
  ok(!all.includes(KEY), 'API key absent from every tool result');
  console.log(process.exitCode ? '\nFAILURES above.' : '\nAll live-path checks passed.');
})();
