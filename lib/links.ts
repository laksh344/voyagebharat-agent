/** Redirect-only booking links, stamped with an affiliate id + a per-link sub-ID so a
 *  click can be matched to a conversion postback. Nothing is booked in the chat. */
const AFF = process.env.AFFILIATE_ID ?? 'voyagebharat';
const sid = (v: string) => `${v}-${Math.random().toString(36).slice(2, 10)}`;
const q = (o: Record<string, string | number>) => new URLSearchParams(Object.entries(o).map(([k, v]) => [k, String(v)])).toString();

export const flightLink = (from: string, to: string, date: string) =>
  `https://flight.easemytrip.com/FlightList/Index?${q({ org: from, dest: to, deptdate: date, adt: 1, utm_source: AFF, utm_content: sid('flight') })}`;
export const trainLink = (from: string, to: string, date: string, cls: string) =>
  `https://www.ixigo.com/search/result/train?${q({ from, to, date, class: cls, utm_source: AFF, utm_content: sid('train') })}`;
export const busLink = (from: string, to: string, date: string) =>
  `https://www.redbus.in/search?${q({ fromCity: from, toCity: to, doj: date, utm_source: AFF, utm_content: sid('bus') })}`;
export const hotelLink = (city: string, checkin: string, checkout: string) =>
  `https://www.agoda.com/search?${q({ city, checkIn: checkin, checkOut: checkout, cid: AFF, utm_content: sid('hotel') })}`;
export const cabLinks = (pickup: string, dropoff: string) => ({
  uber: `https://m.uber.com/ul/?${q({ action: 'setPickup', pickup: 'my_location', 'dropoff[nickname]': dropoff, utm_content: sid('cab') })}`,
  ola: `https://book.olacabs.com/?${q({ serviceType: 'p2p', utm_source: AFF, utm_content: sid('cab') })}`,
  rapido: `https://www.rapido.bike/?${q({ utm_source: AFF, utm_content: sid('cab') })}`,
});
