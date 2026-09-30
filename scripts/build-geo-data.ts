/** Regenerates lib/data/*.json from open datasets: `npm run data:geo`
 *  - Airports: OurAirports (public domain), India, scheduled service, with an IATA code.
 *  - Stations: datameet/railways (CC0), Indian Railways station codes + coordinates. */
import { writeFileSync, mkdirSync } from 'node:fs';

const AIRPORTS_CSV = 'https://davidmegginson.github.io/ourairports-data/airports.csv';
const STATIONS_JSON = 'https://raw.githubusercontent.com/datameet/railways/master/stations.json';
const r4 = (n: number) => Math.round(n * 1e4) / 1e4;

/** Minimal RFC 4180 parser: OurAirports quotes every field and some contain commas. */
function csv(text: string): string[][] {
  const rows: string[][] = []; let row: string[] = [], cell = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; } else if (c === '"') q = false; else cell += c; }
    else if (c === '"') q = true;
    else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; }
    else if (c !== '\r') cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

(async () => {
  const [head, ...rows] = csv(await (await fetch(AIRPORTS_CSV)).text());
  const col = (k: string) => head.indexOf(k);
  const airports = rows
    .filter((r) => r[col('iso_country')] === 'IN' && r[col('scheduled_service')] === 'yes' && /^[A-Z]{3}$/.test(r[col('iata_code')] ?? ''))
    .map((r) => [r[col('iata_code')], r[col('name')], r[col('municipality')], r4(+r[col('latitude_deg')]), r4(+r[col('longitude_deg')])])
    .sort((a, b) => String(a[0]).localeCompare(String(b[0])));

  const geo = await (await fetch(STATIONS_JSON)).json();
  const stations = (geo.features as any[])
    .filter((f) => f.geometry?.coordinates && f.properties?.code && f.properties?.name)
    .map((f) => [String(f.properties.code).trim(), String(f.properties.name).trim(), r4(f.geometry.coordinates[1]), r4(f.geometry.coordinates[0])])
    .filter(([, , lat, lng]) => +lat > 5 && +lat < 38 && +lng > 67 && +lng < 98)
    .sort((a, b) => String(a[0]).localeCompare(String(b[0])));

  mkdirSync('lib/data', { recursive: true });
  writeFileSync('lib/data/airports-in.json', JSON.stringify(airports));
  writeFileSync('lib/data/stations-in.json', JSON.stringify(stations));
  console.log(`airports: ${airports.length}, stations: ${stations.length}`);
})();
