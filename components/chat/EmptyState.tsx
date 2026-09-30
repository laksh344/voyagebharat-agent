'use client';
import { motion } from 'motion/react';
import { useEffect, useState } from 'react';
import { Icon } from './icons';
import { SuggestionCard, type Suggestion } from './SuggestionCard';
import { item, stagger } from './anim';

const SUGGESTIONS: Suggestion[] = [
  { icon: 'route', title: 'Plan a full trip', description: 'Flights or trains, a stay, weather and a real total for your budget.', cta: 'Plan a trip', prompt: 'Plan a 3-day trip to Goa from Hyderabad for 2 people, budget ₹30,000' },
  { icon: 'compare', title: 'Compare ways to travel', description: 'Flight vs train vs bus: time, price and comfort side by side.', cta: 'Compare', prompt: 'Compare flight, train and bus from Pune to Hyderabad next Friday' },
  { icon: 'bed', title: 'Find a stay', description: 'Hotels under your nightly budget with live prices.', cta: 'Find stays', prompt: 'Hotels in Jaipur under ₹3,000 a night for this weekend' },
];

function greetingIST() {
  const h = Number(new Intl.DateTimeFormat('en-GB', { hour: 'numeric', hourCycle: 'h23', timeZone: 'Asia/Kolkata' }).format(new Date()));
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}

export function EmptyState({ onPick }: { onPick: (prompt: string) => void }) {
  // Computed after mount so server and client HTML match.
  const [greeting, setGreeting] = useState('Hello');
  useEffect(() => setGreeting(greetingIST()), []);

  return (
    <motion.section className="hero" variants={stagger} initial="hidden" animate="show" exit={{ opacity: 0, y: -8, transition: { duration: 0.18 } }}>
      <motion.div variants={item} className="orb-wrap">
        <span className="orb"><Icon name="sparkle" size={22} /></span>
      </motion.div>
      <motion.h1 variants={item}>{greeting}<span className="h1-soft">, traveller</span></motion.h1>
      <motion.p variants={item} className="hero-sub">Where are we heading? I compare flights, trains, buses and stays across India.</motion.p>
      <motion.div className="suggestions" variants={stagger}>
        {SUGGESTIONS.map((s) => <SuggestionCard key={s.title} s={s} onPick={onPick} />)}
      </motion.div>
    </motion.section>
  );
}
