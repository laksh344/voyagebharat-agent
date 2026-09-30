/** Exercises every tool directly (no LLM, no API key): `npm run smoke:tools` */
import { tools, parseForecast } from '../lib/tools';
const run = (t: any, input: any) => t.execute(input, { toolCallId: 't', messages: [] });
const ok = (c: boolean, m: string) => { console.log(`${c ? '  PASS' : '  FAIL'}  ${m}`); if (!c) process.exitCode = 1; };
const date = (n: number) => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);

(async () => {
  const d = date(14);
  console.log('\n[1] Hyderabad → Goa');
  const fl: any = await run(tools.searchFlights, { from: 'Hyderabad', to: 'Goa', date: d });
  ok(fl.available && fl.options.length >= 4, `flights: ${fl.options.length} options, cheapest ${fl.highlights.cheapest}`);
  ok(fl.options.some((o: any) => o.tags.includes('cheapest')) && fl.options.some((o: any) => o.tags.includes('fastest')), 'flights tagged cheapest + fastest');
  ok(fl.options.every((o: any, i: number, a: any[]) => i === 0 || a[i - 1].fare <= o.fare), 'flights sorted cheapest-first');
  const tr: any = await run(tools.searchTrains, { from: 'Hyderabad', to: 'Goa', date: d });
  ok(tr.available && tr.options[0].classes.length >= 2, `trains: ${tr.options.length} trains, ${tr.highlights.cheapest}`);
  ok(tr.options.every((t: any) => t.classes.every((c: any) => /^(AVAILABLE|RAC|WL)/.test(c.availability))), 'train availability strings well-formed');
  const bs: any = await run(tools.searchBuses, { from: 'Hyderabad', to: 'Goa', date: d });
  ok(bs.available, `buses: ${bs.options.length} options, ${bs.highlights.cheapest}`);
  const ht: any = await run(tools.searchHotels, { city: 'Goa', checkin: d, nights: 4, maxPricePerNight: 3500 });
  ok(ht.available && ht.options.every((h: any) => h.pricePerNight <= 3500), `hotels: ${ht.options.length} under ₹3,500, ${ht.highlights.cheapest}`);
  const cab: any = await run(tools.getCabHandoff, { pickup: 'Gachibowli', dropoff: 'RGIA Airport', kind: 'airport' });
  ok(cab.uber.includes('uber.com') && cab.ola.includes('olacabs') && cab.rapido.includes('rapido'), `cab links + range ₹${cab.indicativeFareInr.low}–${cab.indicativeFareInr.high}`);
  const wx: any = await run(tools.getWeather, { city: 'Goa', date: date(60) });
  ok(wx.meta.source === 'seasonal-estimate', `weather >16 days ahead falls back to a LABELLED estimate (${wx.maxC}°C, ${wx.summary})`);
  // Offline: Open-Meteo's last forecast day often has null temps/codes (seen 1 Oct 2026 for 16 Oct: 0°/0°C labelled live)
  const om = { daily: { time: ['2026-10-15', '2026-10-16'], temperature_2m_max: [31.3, null], temperature_2m_min: [25.1, null], weather_code: [51, null], precipitation_probability_max: [10, 20] } };
  const good: any = parseForecast(om, 'Goa', '2026-10-15');
  ok(good?.meta.source === 'open-meteo' && good.minC === 25 && good.maxC === 31 && good.summary === 'Drizzle', `complete forecast day parsed live (${good?.minC}–${good?.maxC}°C)`);
  ok(parseForecast(om, 'Goa', '2026-10-16') === undefined, 'null forecast values are rejected, not rounded to 0°C');
  ok(parseForecast({ error: true, reason: 'rate limited' }, 'Goa', '2026-10-15') === undefined && parseForecast(om, 'Goa', '2026-10-17') === undefined, 'error body / date outside window rejected');

  console.log('\n[2] Honest failure paths');
  const mf: any = await run(tools.searchFlights, { from: 'Delhi', to: 'Manali', date: d });
  ok(mf.available === false && /no commercial airport/i.test(mf.reason) && !!mf.suggestion, `Manali flight → "${mf.reason}" → ${mf.suggestion}`);
  const mt: any = await run(tools.searchTrains, { from: 'Delhi', to: 'Manali', date: d });
  ok(mt.available === false && !!mt.suggestion, `Manali train → ${mt.suggestion}`);
  const far: any = await run(tools.searchBuses, { from: 'Kolkata', to: 'Kochi', date: d });
  ok(far.available === false, `Kolkata→Kochi bus refused: ${far.reason}`);
  const unk: any = await run(tools.searchFlights, { from: 'Atlantis', to: 'Goa', date: d });
  ok(unk.available === false, 'unknown city handled without crashing');
  const same: any = await run(tools.searchTrains, { from: 'Pune', to: 'Pune', date: d });
  ok(same.available === false, 'same origin/destination rejected');
  const cap: any = await run(tools.searchHotels, { city: 'Mumbai', checkin: d, nights: 2, maxPricePerNight: 300 });
  ok(cap.available === false, 'impossible hotel cap returns a helpful miss, not an empty list');

  console.log('\n[3] Model behaves sensibly');
  const soon: any = await run(tools.searchFlights, { from: 'Delhi', to: 'Jaipur', date: date(1) });
  const far30: any = await run(tools.searchFlights, { from: 'Delhi', to: 'Jaipur', date: date(45) });
  ok(soon.options[0].fare > far30.options[0].fare, `last-minute dearer than 45 days out (₹${soon.options[0].fare} vs ₹${far30.options[0].fare})`);
  const a: any = await run(tools.searchTrains, { from: 'Delhi', to: 'Jaipur', date: d }), b: any = await run(tools.searchTrains, { from: 'Delhi', to: 'Jaipur', date: d });
  ok(JSON.stringify(a.options.map((o: any) => [o.number, o.classes.map((c: any) => [c.cls, c.fare, c.availability])])) === JSON.stringify(b.options.map((o: any) => [o.number, o.classes.map((c: any) => [c.cls, c.fare, c.availability])])), 'same query → same results (deterministic)');
  ok((await run(tools.searchFlights, { from: 'Hyderabad', to: 'Goa', date: d })).options[0].bookUrl !== fl.options[0].bookUrl, 'each booking link carries a unique sub-ID for attribution');

  console.log('\n[3b] Fixes from the 29 Sep test run');
  const bho: any = await run(tools.searchFlights, { from: 'Hyderabad', to: 'Bhopal', date: d });
  ok(bho.available && bho.route.includes('BHO'), `Bhopal now covered (${bho.highlights.cheapest})`);
  const hpt: any = await run(tools.searchTrains, { from: 'Bengaluru', to: 'Hospet', date: d });
  ok(hpt.available && hpt.route.includes('Hampi'), 'Hospet resolves to Hampi and has trains');
  const hptF: any = await run(tools.searchFlights, { from: 'Hyderabad', to: 'Hampi', date: d });
  ok(hptF.available === false && /Hubballi|Vidyanagar/.test(hptF.suggestion ?? ''), `Hampi flights -> nearest airport: ${hptF.suggestion}`);
  console.log('\n[3c] Any Indian city, not just the curated table');
  const rpr: any = await run(tools.searchTrains, { from: 'Hyderabad', to: 'Raipur', date: d });
  ok(rpr.available && rpr.route.includes('Raipur (R)'), `Raipur resolves to Raipur Jn (${rpr.route})`);
  const rprF: any = await run(tools.searchFlights, { from: 'Hyderabad', to: 'Raipur', date: d });
  ok(rprF.available && rprF.route.includes('RPR'), `Raipur flights via RPR (${rprF.highlights?.cheapest})`);
  const all: any = await run(tools.searchTrains, { from: 'Kochi', to: 'Alleppey', date: d });
  ok(all.available && all.route.includes('ALLP'), 'old name "Alleppey" still resolves (offline station match)');
  const kod: any = await run(tools.searchFlights, { from: 'Chennai', to: 'Kodaikanal', date: d });
  if (kod.available === false && /couldn't find/.test(kod.reason)) console.log('  SKIP  Kodaikanal needs the Open-Meteo geocoder (offline?)');
  else ok(kod.available === false && /no commercial airport/.test(kod.reason) && /IXM/.test(kod.suggestion ?? ''), `hill town without airport → ${kod.suggestion}`);
  const bih: any = await run(tools.searchTrains, { from: 'Patna', to: 'Aurangabad, Bihar', date: d });
  if (bih.available) ok(bih.options[0].durationMin < 8 * 60, `"Aurangabad, Bihar" picks the Bihar town, not Maharashtra (${bih.route})`);
  else console.log('  SKIP  state hint needs the Open-Meteo geocoder (offline?)');

  let lateDayTrain = 0, longIntercity = 0;
  for (const [a, b] of [['Hyderabad', 'Goa'], ['Delhi', 'Jaipur'], ['Pune', 'Hyderabad'], ['Chennai', 'Bengaluru'], ['Mumbai', 'Goa'], ['Delhi', 'Lucknow']])
    for (let k = 0; k < 20; k++) {
      const res: any = await run(tools.searchTrains, { from: a, to: b, date: date(3 + k) });
      for (const t of res.options) {
        const h = Number(t.depart.slice(0, 2));
        if (/^(Vande Bharat|Shatabdi)/.test(t.name) && h > 15) lateDayTrain++;
        if (t.name === 'Intercity Express' && t.durationMin > 8 * 60) longIntercity++;
      }
    }
  ok(lateDayTrain === 0, 'Vande Bharat / Shatabdi never depart after 15:00 (120 searches)');
  ok(longIntercity === 0, 'no "Intercity Express" on long runs');

  console.log('\n[4] Deterministic budget maths');
  const bg: any = await run(tools.estimateBudget, { travelers: 2, budget: 20000, lines: [
    { label: 'Train x2', amount: 1240, category: 'transport' }, { label: 'Hotel 4n', amount: 8800, category: 'stay' },
    { label: 'Cabs', amount: 1400, category: 'local' }, { label: 'Food 2p x4d', amount: 5600, category: 'food' }] });
  ok(bg.total === 17040 && bg.contingency === 1704 && bg.totalWithContingency === 18744, `total ₹${bg.total} + 10% = ₹${bg.totalWithContingency}`);
  ok(bg.withinBudget === true && bg.remaining === 1256, `within ₹20,000 budget with ₹${bg.remaining} to spare`);
  const over: any = await run(tools.estimateBudget, { travelers: 1, budget: 5000, lines: [{ label: 'x', amount: 9000, category: 'other' }] });
  ok(over.withinBudget === false && over.remaining < 0, `over-budget detected (₹${Math.abs(over.remaining)} over)`);
  console.log(process.exitCode ? '\nSOME CHECKS FAILED' : '\nALL CHECKS PASSED');
})();
