/** India city table: coordinates + the airport / railway hub that serves each place.
 *  Distance drives the fare/duration model. Places without an airport or railway
 *  return `null` there and point at the nearest hub instead. */
export interface Place {
  name: string;
  lat: number;
  lng: number;
  iata?: string;
  rail?: string;            // main railway station code
  nearestAir?: string;      // human hint when no airport
  nearestRail?: string;     // human hint when no railway
  costIndex: number;        // hotel price multiplier
  areas: string[];
}

const P = (name: string, lat: number, lng: number, o: Partial<Place> = {}): Place =>
  ({ name, lat, lng, costIndex: 1, areas: ['City Centre', 'Near Station', 'Old Town', 'Airport Road', 'Riverside'], ...o });

export const PLACES: Place[] = [
  P('Hyderabad', 17.385, 78.4867, { iata: 'HYD', rail: 'SC', costIndex: 1.0, areas: ['Gachibowli', 'Hitech City', 'Banjara Hills', 'Secunderabad', 'Begumpet'] }),
  P('Bengaluru', 12.9716, 77.5946, { iata: 'BLR', rail: 'SBC', costIndex: 1.1, areas: ['Indiranagar', 'MG Road', 'Koramangala', 'Whitefield', 'Majestic'] }),
  P('Mumbai', 19.076, 72.8777, { iata: 'BOM', rail: 'CSMT', costIndex: 1.35, areas: ['Colaba', 'Bandra', 'Andheri', 'Juhu', 'Powai'] }),
  P('Delhi', 28.6139, 77.209, { iata: 'DEL', rail: 'NDLS', costIndex: 1.1, areas: ['Connaught Place', 'Aerocity', 'Paharganj', 'Saket', 'Karol Bagh'] }),
  P('Chennai', 13.0827, 80.2707, { iata: 'MAA', rail: 'MAS', costIndex: 1.0, areas: ['T Nagar', 'Egmore', 'Adyar', 'Nungambakkam', 'Mylapore'] }),
  P('Kolkata', 22.5726, 88.3639, { iata: 'CCU', rail: 'HWH', costIndex: 0.95, areas: ['Park Street', 'Salt Lake', 'Howrah', 'New Town', 'Esplanade'] }),
  P('Pune', 18.5204, 73.8567, { iata: 'PNQ', rail: 'PUNE', costIndex: 1.0, areas: ['Koregaon Park', 'Shivajinagar', 'Hinjewadi', 'Viman Nagar', 'Camp'] }),
  P('Goa', 15.4909, 73.8278, { iata: 'GOI', rail: 'MAO', costIndex: 1.15, areas: ['Calangute', 'Candolim', 'Baga', 'Panjim', 'Anjuna'] }),
  P('Jaipur', 26.9124, 75.7873, { iata: 'JAI', rail: 'JP', costIndex: 1.0, areas: ['C-Scheme', 'MI Road', 'Amer Road', 'Bani Park', 'Malviya Nagar'] }),
  P('Udaipur', 24.5854, 73.7125, { iata: 'UDR', rail: 'UDZ', costIndex: 1.05, areas: ['Lake Pichola', 'Fateh Sagar', 'City Palace Road', 'Hiran Magri', 'Chandpole'] }),
  P('Jodhpur', 26.2389, 73.0243, { iata: 'JDH', rail: 'JU', costIndex: 0.95 }),
  P('Ahmedabad', 23.0225, 72.5714, { iata: 'AMD', rail: 'ADI', costIndex: 0.95 }),
  P('Lucknow', 26.8467, 80.9462, { iata: 'LKO', rail: 'LKO', costIndex: 0.9 }),
  P('Varanasi', 25.3176, 82.9739, { iata: 'VNS', rail: 'BSB', costIndex: 0.9, areas: ['Assi Ghat', 'Dashashwamedh', 'Godowlia', 'Cantt', 'Sigra'] }),
  P('Kochi', 9.9312, 76.2673, { iata: 'COK', rail: 'ERS', costIndex: 1.0, areas: ['Fort Kochi', 'Marine Drive', 'Ernakulam', 'Edappally', 'Mattancherry'] }),
  P('Thiruvananthapuram', 8.5241, 76.9366, { iata: 'TRV', rail: 'TVC', costIndex: 0.95 }),
  P('Visakhapatnam', 17.6868, 83.2185, { iata: 'VTZ', rail: 'VSKP', costIndex: 0.95 }),
  P('Chandigarh', 30.7333, 76.7794, { iata: 'IXC', rail: 'CDG', costIndex: 1.0 }),
  P('Amritsar', 31.634, 74.8723, { iata: 'ATQ', rail: 'ASR', costIndex: 0.95 }),
  P('Mysuru', 12.2958, 76.6394, { rail: 'MYS', nearestAir: 'Bengaluru (BLR), ~3 hr by road', costIndex: 0.9 }),
  P('Ooty', 11.41, 76.695, { nearestAir: 'Coimbatore (CJB), ~3.5 hr by road', nearestRail: 'Mettupalayam (MTP) + Nilgiri toy train', costIndex: 0.95, areas: ['Charing Cross', 'Fingerpost', 'Coonoor Road', 'Lake Side', 'Botanical Garden'] }),
  P('Munnar', 10.0889, 77.0595, { nearestAir: 'Kochi (COK), ~4.5 hr by road', nearestRail: 'Aluva / Ernakulam, then road', costIndex: 1.0, areas: ['Munnar Town', 'Chithirapuram', 'Pallivasal', 'Devikulam', 'Anachal'] }),
  P('Manali', 32.2432, 77.1892, { nearestAir: 'Kullu-Manali (KUU, limited flights) or Chandigarh (IXC) + ~7 hr by road', nearestRail: 'Chandigarh (CDG) or Joginder Nagar, then road', costIndex: 0.95, areas: ['Old Manali', 'Mall Road', 'Aleo', 'Vashisht', 'Naggar Road'] }),
  P('Shimla', 31.1048, 77.1734, { rail: 'SML', nearestAir: 'Shimla (SLV, very limited) or Chandigarh (IXC) + ~3 hr by road', costIndex: 1.0 }),
  P('Rishikesh', 30.0869, 78.2676, { nearestAir: 'Dehradun (DED), ~1 hr by road', rail: 'RKSH', costIndex: 0.9 }),
  P('Darjeeling', 27.041, 88.2663, { nearestAir: 'Bagdogra (IXB), ~3.5 hr by road', nearestRail: 'New Jalpaiguri (NJP), then road / toy train', costIndex: 0.95 }),
  P('Leh', 34.1526, 77.5771, { iata: 'IXL', nearestRail: 'None — nearest railhead is Jammu; fly or drive', costIndex: 1.2 }),
  P('Srinagar', 34.0837, 74.7973, { iata: 'SXR', nearestRail: 'Jammu / Udhampur, then road', costIndex: 1.05 }),
  P('Port Blair', 11.6234, 92.7265, { iata: 'IXZ', nearestRail: 'None — island; fly or ship', costIndex: 1.25 }),
];

const norm = (s: string) => s.trim().toLowerCase().replace(/[^a-z ]/g, '');
const ALIASES: Record<string, string> = {
  bangalore: 'bengaluru', bombay: 'mumbai', calcutta: 'kolkata', madras: 'chennai', vizag: 'visakhapatnam',
  trivandrum: 'thiruvananthapuram', mysore: 'mysuru', benares: 'varanasi', banaras: 'varanasi', cochin: 'kochi',
  'new delhi': 'delhi', panaji: 'goa', panjim: 'goa', 'north goa': 'goa', 'south goa': 'goa',
};

export function findPlace(input: string): Place | undefined {
  let q = norm(input);
  q = ALIASES[q] ?? q;
  const first = q.split(' ')[0];
  return PLACES.find((p) => norm(p.name) === q) ?? PLACES.find((p) => norm(p.name) === (ALIASES[first] ?? first));
}

export function km(a: Place, b: Place): number {
  const R = 6371, r = Math.PI / 180;
  const dLat = (b.lat - a.lat) * r, dLng = (b.lng - a.lng) * r;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLng / 2) ** 2;
  // road/rail routes are ~25% longer than the great-circle line
  return Math.round(2 * R * Math.asin(Math.sqrt(h)) * 1.25);
}

export const KNOWN = PLACES.map((p) => p.name).join(', ');
