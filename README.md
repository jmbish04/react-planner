# Smart Architect

> An AI-driven 2D/3D floorplan designer that you can drive from a chat sidebar — or from the Claude iOS app — and watch the canvas update in real time.

**Live:** https://smart-architect.hacolby.workers.dev
**Docs:** [/docs](https://smart-architect.hacolby.workers.dev/docs/) (full technical suite, also in [`docs-site/`](docs-site/))

---

## What it is

Smart Architect is a single Cloudflare Worker that hosts an interactive floorplan
editor built on the open-source [**react-planner**](https://github.com/cvdlab/react-planner)
library. A conversational AI agent (Claude) edits a canonical floorplan "scene"
through a set of structured tools — drawing rooms, walls, doors, windows, and
furniture — while every connected browser sees the changes stream in live over a
WebSocket.

The same blueprint can be edited from two surfaces at once:

- the **chat sidebar** next to the canvas, and
- the **Claude iOS app** (via a custom MCP connector).

Both converge on one authoritative scene held in a Durable Object, versioned in D1.

---

## Architecture overview

The page runs **two completely separate React roots** that never share components:

- **`#canvas`** — react-planner (React **16**, bundled with webpack 4). This is the
  full-bleed 2D/3D editor.
- **`#sidebar`** — the assistant-ui chat (React **19**, bundled with Vite).

They are intentionally **decoupled** because react-planner is effectively pinned to
React 16 while assistant-ui requires React 19. The two roots talk to each other only
through a tiny vanilla **"blueprint bus"** on `window.__planner`
(`getScene()`, `loadScene(scene)`, `onSceneChange(fn)`), defined in `app/index.js`.

```
                    ┌──────────────────────────── Browser ────────────────────────────┐
                    │                                                                  │
   Claude iOS app   │   #canvas (React 16, webpack)      #sidebar (React 19, Vite)     │
        │           │   react-planner editor   <──── window.__planner ────>  chat UI   │
        │           │          ▲                  (getScene/loadScene)          │       │
        │ /mcp       │          │ loadScene()                                    │ WS    │
        ▼           │          │                                                ▼       │
   ┌─────────┐      │   ┌──────┴───────────────────────────────────────────────────┐  │
   │Blueprint│ proxy│   │                  BlueprintAgent (Durable Object)           │  │
   │  MCP DO │─────────▶│  canonical scene JSON in DO state · tools · setState ──────┼──┘
   └─────────┘      │   └────────────────────────┬───────────────────────────────────┘
                    │                             │ versions
                    └─────────────────────────────┼────────────────────────────────────
                                                  ▼
                                            D1: versions (DAG)
```

- **BlueprintAgent** (`worker/agent/blueprint.ts`) is a Cloudflare `AIChatAgent`
  Durable Object. It holds the canonical react-planner scene (plannerState JSON) in DO
  state. When a tool mutates that state via `setState`, the change is broadcast over
  WebSocket to every connected browser, whose `useAgent` `onStateUpdate` calls
  `window.__planner.loadScene`.
- **BlueprintMCP** (`worker/mcp/blueprint-mcp.ts`) is a Cloudflare `McpAgent` Durable
  Object served at `/mcp`. Its tools proxy to the *same* BlueprintAgent instance, so an
  edit issued from the Claude iOS app appears on the desktop canvas in real time.
- **D1** database `smart-architect-db` (via Drizzle ORM, `worker/db/`) stores a
  `versions` table modeled as a **DAG** — each row has a `parent_version_id`, enabling
  rollback, clone, and branch without losing history.

### The chat path

The sidebar wires assistant-ui to the Cloudflare Agent through this chain:

```
useAgent (agents/react)
  → useAgentChat (@cloudflare/ai-chat/react)
  → useAISDKRuntime (@assistant-ui/react-ai-sdk)
  → AssistantRuntimeProvider
```

The UI itself is composed from `@assistant-ui/react` primitives
(`ThreadPrimitive` / `MessagePrimitive` / `ComposerPrimitive`).

---

## Quick start

Requires Node (see `.nvmrc`) and a Cloudflare account with Wrangler authenticated.

```bash
npm install
npm run dev      # wrangler dev (local)
```

> **Local-dev caveat:** local `wrangler dev` cannot read the remote Secrets Store
> secret, so the **live LLM only works on the deployed URL**. The canvas, sidebar, and
> static routes work locally; the agent's model calls do not.

### Build

```bash
npm run build         # build:chat (vite) then build:canvas (webpack) -> dist/
npm run build:chat    # just the React 19 sidebar
npm run build:canvas  # just the react-planner canvas
```

### Deploy

```bash
npm run deploy        # build + db:migrate:remote + wrangler deploy
```

### Database (Drizzle + D1)

```bash
npm run db:generate        # generate a migration from schema changes
npm run db:migrate:local   # apply migrations to the local D1
npm run db:migrate:remote  # apply migrations to the remote D1
```

### Common commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Local worker via `wrangler dev` |
| `npm run build` | Build sidebar + canvas into `dist/` |
| `npm run deploy` | Build, migrate remote D1, deploy |
| `npm run db:generate` | Generate a Drizzle migration |
| `npm run db:migrate:remote` | Apply migrations to remote D1 |
| `npm run types` | Regenerate `worker-configuration.d.ts` (auto-generated — do not edit) |

---

## AI Gateway BYOK setup

The model is **Claude `claude-opus-4-8`** routed through **Cloudflare AI Gateway** in
**BYOK** (bring-your-own-key) mode.

- Gateway name: `default-gateway`
- Base URL: `https://gateway.ai.cloudflare.com/v1/<ACCOUNT_ID>/default-gateway/anthropic`

Setup steps:

1. **Store your Anthropic key in the Gateway.** In the Cloudflare dashboard, go to
   **AI Gateway → `default-gateway` → Provider Keys** and add your real Anthropic API key.
2. **Store the Gateway token in Secrets Store.** The worker binds it as
   `CLOUDFLARE_AI_GATEWAY_TOKEN` (a Secrets Store binding in `wrangler.jsonc`) and reads
   it with `await env.CLOUDFLARE_AI_GATEWAY_TOKEN.get()`.
3. The worker passes that token as the provider **`apiKey`** (sent as `x-api-key`). The
   Gateway recognizes the token and swaps in the stored real Anthropic key.

> ⚠️ **Gotcha:** Do **not** use a `cf-aig-authorization` header for this. In BYOK mode
> the token belongs in the provider **`apiKey`** — that is the correct contract. See
> `worker/ai/anthropic.ts`.

No secret values are stored in this repo.

---

## Connecting the Claude iOS app

You can drive the same blueprint from your phone:

1. In the **Claude iOS app**, add a **custom MCP connector**.
2. Point it at: `https://smart-architect.hacolby.workers.dev/mcp`
3. Ask Claude to draw or modify a room. The MCP tools proxy to the same
   `BlueprintAgent` Durable Object (`getAgentByName(env.BlueprintAgent, 'default')`),
   so the edit mutates the same scene your desktop browser is viewing.
4. Watch the change appear on the desktop canvas **in real time** over the WebSocket.

> ⚠️ The `/mcp` endpoint is currently **unauthenticated** (see Known limitations).

---

## Project layout

```
app/        # app source: index.js (blueprint bus + react-planner mount), index.html, catalog/, components/
chat/       # React 19 assistant-ui sidebar (Vite) -> dist/chat/chat.js + chat.css
worker/     # Cloudflare Worker (TS)
  index.ts            # routes /mcp*, /agents/*, and static assets
  agent/blueprint.ts  # BlueprintAgent (AIChatAgent DO) + tools
  mcp/blueprint-mcp.ts# BlueprintMCP (McpAgent DO) served at /mcp
  ai/anthropic.ts     # Claude via AI Gateway BYOK
  blueprint/scene.ts  # scene helpers (rooms, walls, holes, items)
  db/                 # Drizzle schema, versions, migrations
src/        # react-planner LIBRARY source (consumed via webpack alias react-planner -> src/index)
docs/       # react-planner library docs (HOW_TO_CREATE_*) — upstream, leave as-is
docs-site/  # this app's technical docs site (served at /docs)
archive/legacy-cloudflare/  # a prior, superseded implementation — do not use
wrangler.jsonc, webpack.config.js, drizzle.config.ts, tsconfig.json, package.json
```

---

## Relationship to react-planner

The repo root **is** the Smart Architect app, but it was built on top of the
open-source **react-planner** library, whose source lives at `src/` and is compiled
directly into the app (webpack aliases `react-planner` → `src/index`). The app's own
source — entry point, catalog, and components — lives in `app/`. The upstream library
docs in `docs/` are left as-is.

The `archive/legacy-cloudflare/` folder contains a **prior, superseded** Cloudflare
implementation. Ignore it.

---

## Known limitations

- **Single-tenant, no auth.** The agent/MCP instance name is hardcoded to `"default"`.
- **The `/mcp` endpoint is unauthenticated.** Anyone with the URL can edit the blueprint.
- **The live LLM does not work in local dev** — local `wrangler dev` cannot reach the
  remote Secrets Store. Test the model path on the deployed URL.

---

## More

See **[/docs](https://smart-architect.hacolby.workers.dev/docs/)** for the full
technical suite, and **[AGENTS.md](AGENTS.md)** / **[CLAUDE.md](CLAUDE.md)** if you are
an AI coding agent working in this repo.
