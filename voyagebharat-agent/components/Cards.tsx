import type { ReactNode } from 'react';
import type { FlightOption, TrainOption, BusOption, HotelOption, WeatherOut, BudgetOut, CabOut, Result, Meta } from '@/lib/types';

const inr = (n: number) => `₹${n.toLocaleString('en-IN')}`;
const dur = (m: number) => `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m`;
const SRC: Record<string, string> = { 'sample-model': 'Modelled estimate', 'open-meteo': 'Live forecast', 'seasonal-estimate': 'Seasonal estimate' };

function Tags({ tags }: { tags: string[] }) {
  return <>{tags.filter((t) => t !== 'nonstop').map((t) => <span key={t} className={`tag ${t}`}>{t.replace('_', ' ')}</span>)}</>;
}
function Shell({ icon, title, sub, meta, children }: { icon: string; title: string; sub?: string; meta?: Meta; children: ReactNode }) {
  return (
    <section className="card" aria-label={title}>
      <header className="card-h"><span className="card-i" aria-hidden="true">{icon}</span><div><h3>{title}</h3>{sub && <p>{sub}</p>}</div></header>
      <div className="card-b">{children}</div>
      {meta && <footer className="card-f">{SRC[meta.source] ?? meta.source}{meta.note ? ` · ${meta.note}` : ''}</footer>}
    </section>
  );
}
function Book({ href, label = 'Book' }: { href: string; label?: string }) {
  return <a className="book" href={href} target="_blank" rel="noopener noreferrer sponsored">{label} <span aria-hidden="true">↗</span></a>;
}
export function Unavailable({ icon, title, r }: { icon: string; title: string; r: { reason: string; suggestion?: string } }) {
  return <Shell icon={icon} title={title}><p className="warn">{r.reason}</p>{r.suggestion && <p className="hint">→ {r.suggestion}</p>}</Shell>;
}

export function Flights({ r }: { r: Extract<Result<FlightOption>, { available: true }> }) {
  return (
    <Shell icon="✈️" title="Flights" sub={`${r.route} · ${r.date}`} meta={r}>
      {r.options.map((o, i) => (
        <div className="row" key={i}>
          <div className="row-main"><strong>{o.airline}</strong> <span className="dim">{o.flightNo}</span><Tags tags={o.tags} /></div>
          <div className="row-mid">{o.depart} → {o.arrive} <span className="dim">· {dur(o.durationMin)} · {o.stops ? `${o.stops} stop` : 'nonstop'}</span></div>
          <div className="row-end"><span className="price">{inr(o.fare)}</span><Book href={o.bookUrl} /></div>
        </div>
      ))}
    </Shell>
  );
}
export function Trains({ r }: { r: Extract<Result<TrainOption>, { available: true }> }) {
  return (
    <Shell icon="🚆" title="Trains" sub={`${r.route} · ${r.date}`} meta={r}>
      {r.options.map((o, i) => (
        <div className="row col" key={i}>
          <div className="row-main"><strong>{o.name}</strong> <span className="dim">#{o.number}</span><Tags tags={o.tags} /></div>
          <div className="row-mid">{o.depart} → {o.arrive} <span className="dim">· {dur(o.durationMin)}</span></div>
          <div className="chips2">
            {o.classes.map((c) => (
              <a key={c.cls} className={`cls ${c.availability.startsWith('AVAIL') ? 'ok' : c.availability.startsWith('RAC') ? 'rac' : 'wl'}`} href={c.bookUrl} target="_blank" rel="noopener noreferrer sponsored">
                <b>{c.cls}</b> {inr(c.fare)}<small>{c.availability}</small>
              </a>
            ))}
          </div>
        </div>
      ))}
    </Shell>
  );
}
export function Buses({ r }: { r: Extract<Result<BusOption>, { available: true }> }) {
  return (
    <Shell icon="🚌" title="Buses" sub={`${r.route} · ${r.date}`} meta={r}>
      {r.options.map((o, i) => (
        <div className="row" key={i}>
          <div className="row-main"><strong>{o.operator}</strong> <span className="dim">{o.type}</span><Tags tags={o.tags} /></div>
          <div className="row-mid">{o.depart} → {o.arrive} <span className="dim">· {dur(o.durationMin)} · {o.seatsLeft} seats left</span></div>
          <div className="row-end"><span className="price">{inr(o.fare)}</span><Book href={o.bookUrl} /></div>
        </div>
      ))}
    </Shell>
  );
}
export function Hotels({ r }: { r: Extract<Result<HotelOption>, { available: true }> }) {
  return (
    <Shell icon="🏨" title="Hotels" sub={`${r.route} · ${r.date}`} meta={r}>
      {r.options.map((o, i) => (
        <div className="row" key={i}>
          <div className="row-main"><strong>{o.name}</strong> <span className="dim">{'★'.repeat(o.stars)} · {o.area}</span><Tags tags={o.tags} /></div>
          <div className="row-mid">Rated {o.rating}/5 <span className="dim">· {o.freeCancellation ? 'free cancellation' : 'non-refundable'}</span></div>
          <div className="row-end"><span className="price">{inr(o.pricePerNight)}<small>/night</small></span><Book href={o.bookUrl} /></div>
        </div>
      ))}
    </Shell>
  );
}
export function Weather({ r }: { r: WeatherOut }) {
  return (
    <Shell icon="🌤" title="Weather" sub={`${r.place} · ${r.date}`} meta={r.meta}>
      <div className="wx"><span className="big">{r.maxC}°</span><span className="dim">/ {r.minC}°C</span><span>{r.summary}</span>{r.rainChancePct != null && <span className="dim">· {r.rainChancePct}% rain</span>}</div>
    </Shell>
  );
}
export function Cab({ r }: { r: CabOut }) {
  return (
    <Shell icon="🚕" title="Local ride" sub={`${r.pickup} → ${r.dropoff}`}>
      <div className="row"><div className="row-main">Indicative <span className="price">{inr(r.indicativeFareInr.low)}–{inr(r.indicativeFareInr.high)}</span></div>
        <div className="row-end"><Book href={r.uber} label="Uber" /><Book href={r.ola} label="Ola" /><Book href={r.rapido} label="Rapido" /></div></div>
    </Shell>
  );
}
export function Budget({ r }: { r: BudgetOut }) {
  const max = Math.max(...Object.values(r.byCategory));
  return (
    <section className="card budget" aria-label="Trip budget">
      <header className="card-h"><span className="card-i" aria-hidden="true">💸</span><div><h3>Trip budget</h3><p>{r.travelers} traveler{r.travelers > 1 ? 's' : ''} · {inr(r.perPerson)} per person</p></div></header>
      <div className="card-b">
        {Object.entries(r.byCategory).map(([k, v]) => (
          <div className="bar" key={k}><span className="bar-l">{k}</span><span className="bar-t"><i style={{ width: `${Math.max(6, (v / max) * 100)}%` }} /></span><span className="bar-v">{inr(v)}</span></div>
        ))}
        <div className="total"><span>Total</span><strong>{inr(r.total)}</strong></div>
        <div className="sub"><span>+10% buffer</span><span>{inr(r.totalWithContingency)}</span></div>
        {r.budget != null && (
          <p className={`verdict ${r.withinBudget ? 'ok' : 'over'}`}>{r.withinBudget ? `✓ Within your ${inr(r.budget)} budget — ${inr(r.remaining ?? 0)} to spare` : `✕ ${inr(Math.abs(r.remaining ?? 0))} over your ${inr(r.budget)} budget`}</p>
        )}
      </div>
    </section>
  );
}
