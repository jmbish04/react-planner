// Runs before any other import (must be the first import in main.tsx).
// React 18 + agents/ai SDKs read `process.env.*` in the browser bundle, which
// Vite's library build does not provide. Define a minimal shim.
const g = globalThis as unknown as { process?: { env: Record<string, string> } };
if (!g.process) g.process = { env: { NODE_ENV: 'production' } };
if (!g.process.env) g.process.env = { NODE_ENV: 'production' };
