'use client';
import { motion } from 'motion/react';
import { Icon, type IconName } from './icons';
import { item } from './anim';

export interface Suggestion { icon: IconName; title: string; description: string; cta: string; prompt: string }

/** The whole card is one button (the "Plan a trip" pill is part of it), so there's no nested interactive element. */
export function SuggestionCard({ s, onPick }: { s: Suggestion; onPick: (prompt: string) => void }) {
  return (
    <motion.button type="button" className="suggest" variants={item} whileHover={{ y: -2 }} whileTap={{ scale: 0.98 }} onClick={() => onPick(s.prompt)}>
      <span className="suggest-icon"><Icon name={s.icon} size={20} /></span>
      <span className="suggest-title">{s.title}</span>
      <span className="suggest-desc">{s.description}</span>
      <span className="suggest-cta">{s.cta}</span>
    </motion.button>
  );
}
