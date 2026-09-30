'use client';
import { useChat } from '@ai-sdk/react';
import { AnimatePresence, MotionConfig } from 'motion/react';
import { useCallback, useEffect, useState } from 'react';
import { TopBar } from './chat/TopBar';
import { EmptyState } from './chat/EmptyState';
import { MessageList } from './chat/MessageList';
import { Composer } from './chat/Composer';
import { Toast, type ToastMessage } from './chat/Toast';
import { transcript } from './chat/Message';

export default function Chat() {
  const { messages, sendMessage, status, stop, error, setMessages } = useChat();
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const busy = status === 'submitted' || status === 'streaming';

  const send = useCallback((text: string) => {
    const v = text.trim();
    if (!v || busy) return;
    sendMessage({ text: v });
  }, [busy, sendMessage]);

  const newChat = () => { stop(); setMessages([]); window.scrollTo({ top: 0 }); };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(transcript(messages));
      setToast({ id: Date.now(), text: 'Conversation copied', ok: true });
    } catch {
      setToast({ id: Date.now(), text: "Couldn't copy — your browser blocked clipboard access", ok: false });
    }
  };
  const clearToast = useCallback(() => setToast(null), []);

  useEffect(() => {
    if (!busy) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') stop(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [busy, stop]);

  return (
    <MotionConfig reducedMotion="user">
      <div className="app">
        <TopBar hasMessages={messages.length > 0} onNewChat={newChat} onCopy={copy} />
        <main className="main">
          <AnimatePresence mode="wait">
            {messages.length === 0
              ? <EmptyState key="empty" onPick={send} />
              : <MessageList key="list" messages={messages} status={status} error={error} />}
          </AnimatePresence>
        </main>
        <Composer busy={busy} onSend={send} onStop={stop} />
        <Toast toast={toast} onDone={clearToast} />
      </div>
    </MotionConfig>
  );
}
