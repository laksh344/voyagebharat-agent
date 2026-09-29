import type { Metadata } from 'next';
import { tools } from '@/lib/tools';
import { Flights, Trains, Buses, Hotels, Weather, Cab, Budget, Unavailable } from '@/components/Cards';

export const metadata: Metadata = { title: 'Component gallery — VoyageBHARAT', robots: { index: false } };
export const dynamic = 'force-dynamic';
const run = (t: any, input: any) => t.execute(input, { toolCallId: 'p', messages: [] });

/** Design-QA page: every result card rendered from real tool output. No model or API key needed. */
export default async function Preview() {
  const d = new Date(Date.now() + 14 * 864e5).toISOString().slice(0, 10);
  const [fl, tr, bs, ht, wx, cab, bg, manali] = await Promise.all([
    run(tools.searchFlights, { from: 'Hyderabad', to: 'Goa', date: d }), run(tools.searchTrains, { from: 'Hyderabad', to: 'Goa', date: d }),
    run(tools.searchBuses, { from: 'Hyderabad', to: 'Goa', date: d }), run(tools.searchHotels, { city: 'Goa', checkin: d, nights: 4, maxPricePerNight: 4000 }),
    run(tools.getWeather, { city: 'Goa', date: d }), run(tools.getCabHandoff, { pickup: 'Gachibowli', dropoff: 'RGIA Airport', kind: 'airport' }),
    run(tools.estimateBudget, { travelers: 2, budget: 20000, lines: [{ label: 'Train x2', amount: 1240, category: 'transport' }, { label: 'Hotel 4n', amount: 9200, category: 'stay' }, { label: 'Cabs', amount: 1400, category: 'local' }, { label: 'Food', amount: 5600, category: 'food' }] }),
    run(tools.searchFlights, { from: 'Delhi', to: 'Manali', date: d }),
  ]);
  return (
    <div className="shell"><main className="thread" style={{ paddingTop: 24 }}>
      <h1 style={{ fontSize: 28, letterSpacing: '-.03em' }}>Component gallery</h1>
      <Trains r={tr} /><Flights r={fl} /><Buses r={bs} /><Hotels r={ht} /><Weather r={wx} /><Cab r={cab} /><Budget r={bg} />
      <Unavailable icon="ℹ️" title="Searching flights" r={manali} />
    </main></div>
  );
}
