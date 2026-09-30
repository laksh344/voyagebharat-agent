'use client';
import { AnimatePresence, motion } from 'motion/react';
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react';
import { Icon } from './icons';
import { SPRING } from './anim';

export function Composer({ busy, onSend, onStop }: { busy: boolean; onSend: (text: string) => void; onStop: () => void }) {
  const [value, setValue] = useState('');
  const ref = useRef<HTMLTextAreaElement>(null);
  const hasText = value.trim().length > 0;

  // Auto-grow up to the CSS max-height (~6 lines), then scroll. The scrollbar stays hidden below the cap:
  // at fractional zoom (e.g. 150% Windows scaling) scrollHeight rounds and would otherwise show a scrollbar
  // and scroll the placeholder out of view.
  const fit = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    const max = parseFloat(getComputedStyle(el).maxHeight);
    const needed = el.scrollHeight + 1;
    el.style.height = `${Math.min(needed, max)}px`;
    el.style.overflowY = needed > max ? 'auto' : 'hidden';
  }, []);
  useLayoutEffect(fit, [value, fit]);
  // Text metrics can change after the first measure (web font swap, resize, browser text scaling).
  useEffect(() => {
    document.fonts?.ready.then(fit);
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, [fit]);

  const submit = () => {
    if (busy || !hasText) return;
    onSend(value.trim());
    setValue('');
  };
  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      submit();
    }
  };

  return (
    <form className="composer" onSubmit={(e) => { e.preventDefault(); submit(); }}>
      <div className="composer-pill">
        <label htmlFor="q" className="sr">Ask about a trip</label>
        <textarea id="q" ref={ref} rows={1} value={value} maxLength={1500} placeholder="Ask about a trip…" autoComplete="off"
          onChange={(e) => setValue(e.target.value)} onKeyDown={onKeyDown} />
        <AnimatePresence mode="popLayout" initial={false}>
          {busy ? (
            <motion.button key="stop" type="button" className="send stop" onClick={onStop} aria-label="Stop generating" title="Stop (Esc)"
              initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.6, opacity: 0 }} transition={SPRING}>
              <Icon name="stop" />
            </motion.button>
          ) : (
            <motion.button key="send" type="submit" className="send" disabled={!hasText} aria-label="Send message"
              initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: hasText ? 1 : 0.9, opacity: 1 }} exit={{ scale: 0.6, opacity: 0 }} transition={SPRING}>
              <Icon name="arrowUp" />
            </motion.button>
          )}
        </AnimatePresence>
      </div>
      <p className="fine">Flight and hotel prices are live where marked; trains and buses are estimates. Booking happens on the provider&apos;s site — never here.</p>
    </form>
  );
}
