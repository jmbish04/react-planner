import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Button } from './ui/button';
import {
  subscribeLogs, getEntries, getHasError, clearLogs, formatAsAgentPrompt, type LogEntry,
} from '../debug-log';

const levelColor: Record<string, string> = {
  error: 'text-destructive',
  warn: 'text-amber-400',
  info: 'text-sky-400',
  log: 'text-muted-foreground',
};

function CopyIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect width="14" height="14" x="8" y="8" rx="2" ry="2" /><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
    </svg>
  );
}

export function DebugPanel() {
  const entries = useSyncExternalStore(subscribeLogs, getEntries);
  const hasError = useSyncExternalStore(subscribeLogs, getHasError);
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const userClosedRef = useRef(false);

  // Auto-reveal on first error to draw attention to the failure.
  useEffect(() => {
    if (hasError && !open && !userClosedRef.current) setOpen(true);
  }, [hasError, open]);

  useEffect(() => {
    if (open) listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [entries, open]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(formatAsAgentPrompt());
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* clipboard blocked */ }
  }

  const errorCount = entries.filter((e: LogEntry) => e.level === 'error').length;

  return (
    <div className="sa-debug">
      <button
        className="sa-debug-toggle"
        onClick={() => { const next = !open; setOpen(next); if (!next) userClosedRef.current = true; }}
        data-haserror={hasError}
      >
        <span>{open ? '▾' : '▸'} Debug logs ({entries.length})</span>
        {errorCount > 0 && <span className="sa-debug-badge">{errorCount} error{errorCount > 1 ? 's' : ''}</span>}
      </button>

      {open && (
        <div className="sa-debug-body">
          <div className="sa-debug-actions">
            <Button size="sm" variant="secondary" onClick={copy}>
              <CopyIcon /> {copied ? 'Copied prompt' : 'Copy as agent prompt'}
            </Button>
            <Button size="sm" variant="ghost" onClick={clearLogs}>Clear</Button>
          </div>
          <div className="sa-debug-list" ref={listRef}>
            {entries.length === 0 && <div className="sa-debug-empty">No logs yet.</div>}
            {entries.map((e: LogEntry) => (
              <div key={e.id} className={`sa-debug-line ${levelColor[e.level] || ''}`}>
                <span className="sa-debug-time">{new Date(e.ts).toLocaleTimeString()}</span>
                <span className="sa-debug-src">{e.source}</span>
                <span className="sa-debug-text">{e.text}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
