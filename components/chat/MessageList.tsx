'use client';
import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useRef, useState } from 'react';
import { isToolUIPart, type ChatStatus, type UIMessage } from 'ai';
import { Message } from './Message';
import { Icon } from './icons';
import { rise } from './anim';

const NEAR_BOTTOM = 80;
const toBottom = (smooth = false) => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: smooth ? 'smooth' : 'auto' });

export function MessageList({ messages, status, error }: { messages: UIMessage[]; status: ChatStatus; error: Error | undefined }) {
  const [atBottom, setAtBottom] = useState(true);
  const follow = useRef(true);
  const lastUserId = useRef<string | null>(null);

  useEffect(() => {
    const onScroll = () => {
      const d = document.documentElement;
      const near = d.scrollHeight - (window.scrollY + window.innerHeight) < NEAR_BOTTOM;
      follow.current = near;
      setAtBottom(near);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => { window.removeEventListener('scroll', onScroll); window.removeEventListener('resize', onScroll); };
  }, []);

  // Follow new content (instant scroll, so the "near bottom" check never sees a half-finished smooth scroll).
  // A newly sent message always pulls the view down again.
  useEffect(() => {
    const lastUser = [...messages].reverse().find((m) => m.role === 'user');
    if (lastUser && lastUser.id !== lastUserId.current) { lastUserId.current = lastUser.id; follow.current = true; }
    if (follow.current) toBottom();
  }, [messages, status]);

  const last = messages[messages.length - 1];
  const lastHasContent = last?.role === 'assistant' && last.parts.some((p) => (p.type === 'text' && p.text.trim()) || isToolUIPart(p));
  const thinking = status === 'submitted' || (status === 'streaming' && !lastHasContent);

  return (
    <>
      <motion.div className="log" role="log" aria-live="polite" aria-label="Conversation" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.25 }}>
        {messages.map((m, i) => <Message key={m.id} message={m} streaming={status === 'streaming' && i === messages.length - 1} />)}
        {thinking && (
          <motion.div className="thinking" {...rise}>
            <span className="dots" aria-hidden="true"><i /><i /><i /></span>Thinking…
          </motion.div>
        )}
        {error && <p className="alert" role="alert">Something went wrong. Try again in a moment.</p>}
      </motion.div>
      <AnimatePresence>
        {!atBottom && (
          <motion.button type="button" className="jump" onClick={() => { follow.current = true; toBottom(true); }}
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }} transition={{ duration: 0.2 }}>
            Jump to latest <Icon name="arrowDown" size={14} />
          </motion.button>
        )}
      </AnimatePresence>
    </>
  );
}
