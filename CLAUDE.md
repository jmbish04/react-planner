# CLAUDE.md — working notes for Claude Code

This repo is **Smart Architect**, an AI floorplan designer deployed as a single
Cloudflare Worker. **See [AGENTS.md](AGENTS.md) for the full architecture + gotchas.**
This file is the short, Claude-Code-specific version.

## Highest-value gotchas (don't skip these)

- **BYOK token goes in `apiKey`, NOT `cf-aig-authorization`.** The AI Gateway token is
  read from the Secrets Store binding and passed as the provider `apiKey`. See
  `worker/ai/anthropic.ts`. Adding a `cf-aig-authorization` header breaks it.
- **Two React versions stay decoupled.** Canvas = react-planner (React 16, webpack);
  sidebar = assistant-ui (React 19, Vite). They are separate roots that talk only via
  `window.__planner`. Never merge them.
- **Route scene loads through `normalizeScene()`** (`app/index.js`) and **do not re-add
  the react-planner Autosave plugin** — it restores un-normalized scenes and crashes
  renderers. The DO + D1 are the source of truth.
- **MCP tools proxy to the shared BlueprintAgent DO** — keep `worker/mcp/blueprint-mcp.ts`
  in parity with `worker/agent/blueprint.ts`.
- **`worker-configuration.d.ts` is auto-generated** (`npm run types`) — never hand-edit.
- **Never commit** `dist/`, `node_modules/`, `.dev.vars`, or secrets.

## Claude-Code-specific tips

- **Prefer `npm run deploy`** to ship (it builds, runs `db:migrate:remote`, and deploys).
- **Test the LLM path only on the deployed URL.** Local `wrangler dev` cannot read the
  remote Secrets Store, so model calls fail locally. The canvas/sidebar/static routes do
  work locally, but to verify the agent end-to-end you must deploy.
- **Verify UI changes in a real browser**, not just by reading code — the live WebSocket
  state sync (iOS/MCP → DO → desktop canvas) is the whole point and only shows up live.
- **Use the debug panel as the fast path for frontend errors.** The sidebar has a
  collapsible debug log panel (hidden by default, auto-reveals on error) with a
  "Copy as agent prompt" button. When a user hits a frontend bug, have them click it —
  it copies the captured console + agent/scene logs already wrapped in a coding-agent
  debugging prompt, ready to paste back to you.

## Quick reference

- Live: https://smart-architect.hacolby.workers.dev · MCP: `/mcp` · docs: `/docs`
- Build: `npm run build` (chat via Vite, then canvas via webpack → `dist/`)
- Model `claude-opus-4-8` via AI Gateway `default-gateway` (BYOK)
- D1 `smart-architect-db`; versions stored as a DAG (`parent_version_id`)
- Coordinates: cm, origin top-left, +x right / +y down, default canvas 3000×2000
