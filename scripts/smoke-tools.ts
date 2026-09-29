/** Exercises every tool directly (no LLM, no API key): `npm run smoke:tools` */
import { tools } from '../lib/tools';
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
