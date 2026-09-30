'use client';
import { AnimatePresence, motion } from 'motion/react';
import { useEffect } from 'react';
import { Icon } from './icons';
import { EASE } from './anim';

export interface ToastMessage { id: number; text: string; ok: boolean }

export function Toast({ toast, onDone }: { toast: ToastMessage | null; onDone: () => void }) {
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(onDone, 2200);
    return () => clearTimeout(t);
  }, [toast, onDone]);

  return (
    <div className="toast-wrap" role="status" aria-live="polite">
      <AnimatePresence>
        {toast && (
          <motion.div key={toast.id} className="toast" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 16 }} transition={{ duration: 0.25, ease: EASE }}>
            <Icon name={toast.ok ? 'check' : 'info'} size={16} /> {toast.text}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
