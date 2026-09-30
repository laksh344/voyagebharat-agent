import type { Transition, Variants } from 'motion/react';

export const EASE = [0.22, 1, 0.36, 1] as const;
export const SPRING: Transition = { type: 'spring', stiffness: 520, damping: 32, mass: 0.7 };

export const rise = {
  initial: { opacity: 0, y: 6 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.3, ease: EASE },
} as const;

export const stagger: Variants = { hidden: {}, show: { transition: { staggerChildren: 0.06 } } };
export const item: Variants = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: EASE } },
};
