export type Source = 'sample-model' | 'open-meteo' | 'seasonal-estimate';
export interface Meta { source: Source; asOf: string; note?: string }

export interface FlightOption { airline: string; flightNo: string; depart: string; arrive: string; durationMin: number; stops: number; fare: number; tags: string[]; bookUrl: string }
export interface TrainClassOpt { cls: string; availability: string; fare: number; bookUrl: string }
export interface TrainOption { number: string; name: string; depart: string; arrive: string; durationMin: number; classes: TrainClassOpt[]; tags: string[] }
export interface BusOption { operator: string; type: string; depart: string; arrive: string; durationMin: number; seatsLeft: number; fare: number; tags: string[]; bookUrl: string }
export interface HotelOption { name: string; area: string; stars: number; rating: number; pricePerNight: number; freeCancellation: boolean; tags: string[]; bookUrl: string }

export interface Unavailable { available: false; reason: string; suggestion?: string }
export type Result<T> = ({ available: true; route: string; date: string; options: T[]; highlights: Record<string, string> } & Meta) | Unavailable;

export interface WeatherOut { place: string; date: string; minC: number; maxC: number; summary: string; rainChancePct?: number; meta: Meta }
export interface BudgetOut {
  currency: 'INR'; lines: { label: string; amount: number; category: string }[];
  byCategory: Record<string, number>; total: number; perPerson: number; contingency: number; totalWithContingency: number;
  travelers: number; budget?: number; withinBudget?: boolean; remaining?: number;
}
export interface CabOut { pickup: string; dropoff: string; indicativeFareInr: { low: number; high: number }; uber: string; ola: string; rapido: string; note: string }
