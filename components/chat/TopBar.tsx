import { Icon } from './icons';

export function TopBar({ hasMessages, onNewChat, onCopy }: { hasMessages: boolean; onNewChat: () => void; onCopy: () => void }) {
  return (
    <header className="topbar">
      <div className="topbar-in">
        <button type="button" className="pill" onClick={onNewChat} disabled={!hasMessages}>
          <Icon name="plus" size={16} /> New chat
        </button>
        <span className="wordmark" aria-label="VoyageBHARAT">
          <svg viewBox="0 0 32 32" width="22" height="22" aria-hidden="true">
            <path d="M6 22C12 8 20 8 26 22" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
            <circle cx="6" cy="22" r="2.6" className="wm-a" /><circle cx="26" cy="22" r="2.6" className="wm-b" />
          </svg>
          <span aria-hidden="true">Voyage<b>BHARAT</b></span>
        </span>
        <button type="button" className="icon-btn" onClick={onCopy} disabled={!hasMessages} aria-label="Copy conversation" title="Copy conversation">
          <Icon name="copy" />
        </button>
      </div>
    </header>
  );
}
