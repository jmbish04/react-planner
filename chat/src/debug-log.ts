// Lightweight in-memory debug log store for the sidebar's debug panel.
// Captures console output + custom app events (agent lifecycle, scene applies,
// tool activity) and exposes a subscription for the UI. Errors flip `hasError`
// so the panel can auto-reveal itself.

export type LogLevel = 'log' | 'info' | 'warn' | 'error';

export interface LogEntry {
  id: number;
  ts: number;
  level: LogLevel;
  source: string;
  text: string;
}

const MAX = 500;
let entries: LogEntry[] = [];
let seq = 0;
let hasError = false;
const listeners = new Set<() => void>();

function emit() { listeners.forEach((fn) => { try { fn(); } catch { /* ignore */ } }); }

function stringify(args: unknown[]): string {
  return args.map((a) => {
    if (typeof a === 'string') return a;
    if (a instanceof Error) return a.stack || a.message;
    try { return JSON.stringify(a); } catch { return String(a); }
  }).join(' ');
}

export function pushLog(level: LogLevel, source: string, ...args: unknown[]) {
  // New array reference each call so useSyncExternalStore detects the change.
  const next = entries.concat({ id: ++seq, ts: Date.now(), level, source, text: stringify(args) });
  entries = next.length > MAX ? next.slice(-MAX) : next;
  if (level === 'error') hasError = true;
  emit();
}

export function getEntries(): LogEntry[] { return entries; }
export function getHasError(): boolean { return hasError; }
export function clearLogs() { entries = []; hasError = false; emit(); }
export function subscribeLogs(fn: () => void): () => void { listeners.add(fn); return () => listeners.delete(fn); }

// Wrap console.* so existing verbose logs (react-planner, app, agent) are
// captured into the panel while still reaching the real devtools console.
let installed = false;
export function installConsoleCapture() {
  if (installed) return;
  installed = true;
  (['log', 'info', 'warn', 'error'] as const).forEach((level) => {
    const orig = console[level].bind(console);
    console[level] = (...args: unknown[]) => {
      pushLog(level, 'console', ...args);
      orig(...args);
    };
  });
  window.addEventListener('error', (e) => pushLog('error', 'window', e.message, e.error?.stack || ''));
  window.addEventListener('unhandledrejection', (e) => pushLog('error', 'promise', String((e as PromiseRejectionEvent).reason)));
}

// Format the captured logs as a ready-to-paste prompt for a coding agent.
export function formatAsAgentPrompt(): string {
  const lines = entries.map((e) => {
    const t = new Date(e.ts).toISOString().slice(11, 23);
    return `[${t}] ${e.level.toUpperCase()} (${e.source}) ${e.text}`;
  });
  return `You are a senior engineer debugging the **Smart Architect** app: a react-planner 2D/3D floorplan canvas (React 16, webpack) with an assistant-ui chat sidebar (React 19, Vite) that talks to a Cloudflare \`AIChatAgent\` Durable Object (Claude via AI Gateway). The agent edits a shared plannerState scene; the canvas mirrors it over WebSocket. An MCP server at /mcp exposes the same tools.

Below are frontend debug logs from a live session. Identify the root cause of any errors or unexpected behavior and propose a concrete fix (file + change). If the logs look healthy, say so.

<debug-logs>
${lines.join('\n')}
</debug-logs>`;
}
