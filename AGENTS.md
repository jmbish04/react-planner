# AGENTS.md — briefing for AI coding agents

This repo is **Smart Architect**, an AI-driven 2D/3D floorplan designer deployed as a
single Cloudflare Worker (`https://smart-architect.hacolby.workers.dev`). The repo root
**is** the app; it was built on top of the open-source **react-planner** library
(source at `src/`). Read this whole file before editing — there are several non-obvious
gotchas that will silently break things if you ignore them.

---

## Mental model

There are **two separate React roots on one page** that never share components:

| Root | Mount | React | Bundler | Source |
| --- | --- | --- | --- | --- |
| Canvas (react-planner editor) | `#canvas` | **16** | webpack 4 | `src/` (library) + `app/` (app) |
| Chat sidebar (assistant-ui)   | `#sidebar` | **19** | Vite | `chat/` → `dist/chat/chat.{js,css}` |

They communicate only through a vanilla **blueprint bus** on `window.__planner`,
defined in `app/index.js`:

- `getScene()` — return the current react-planner scene JSON
- `loadScene(scene)` — load a scene into the canvas (after normalization)
- `onSceneChange(fn)` — subscribe to scene changes

The **canonical** scene lives server-side in the **BlueprintAgent** Durable Object
(`worker/agent/blueprint.ts`). Tools mutate DO state via `setState`, which broadcasts
over WebSocket to connected browsers; the client's `useAgent` `onStateUpdate` calls
`window.__planner.loadScene` so the canvas updates live. **D1 + the DO are the source
of truth**, not the browser.

The chat path is:
`useAgent` (agents/react) → `useAgentChat` (@cloudflare/ai-chat/react) →
`useAISDKRuntime` (@assistant-ui/react-ai-sdk) → `AssistantRuntimeProvider`.

The **BlueprintMCP** Durable Object (`worker/mcp/blueprint-mcp.ts`) is served at `/mcp`
and proxies its tools to the **same** BlueprintAgent instance
(`getAgentByName(env.BlueprintAgent, 'default')` → `getScene`/`syncScene`). So a prompt
from the Claude iOS app mutates the same blueprint the desktop browser is viewing.

---

## Non-obvious gotchas — read these

1. **BYOK token goes in `apiKey`, NOT `cf-aig-authorization`.** The AI Gateway token is
   read from the Secrets Store binding (`await env.CLOUDFLARE_AI_GATEWAY_TOKEN.get()`)
   and passed as the provider `apiKey` (sent as `x-api-key`). The Gateway swaps in the
   stored real Anthropic key. Do **not** add a `cf-aig-authorization` header — that
   breaks it. See `worker/ai/anthropic.ts`. The Anthropic key must be stored in the
   dashboard under **AI Gateway → default-gateway → Provider Keys**.

2. **The two React versions must stay decoupled.** react-planner is React 16; assistant-ui
   needs React 19. Do not try to import sidebar components into the canvas bundle or vice
   versa, and do not try to unify them onto one React. They are two roots, two bundles,
   talking only through `window.__planner`.

3. **`normalizeScene()` + no Autosave.** Agent-produced elements often omit per-element
   properties (e.g. a door's width/height). `app/index.js`'s `normalizeScene()` fills
   missing properties from the catalog's `defaultValue`s before `loadProject`, so
   react-planner renderers don't crash. The react-planner **Autosave plugin was removed**
   because it restored un-normalized scenes from localStorage, bypassing normalization.
   Do not re-add Autosave. Always route scene loads through `normalizeScene`.

4. **MCP proxies to the BlueprintAgent DO.** Don't give BlueprintMCP its own scene state.
   Its tools must call into the shared BlueprintAgent so iOS and desktop stay in sync.
   Keep the MCP tool set in **parity** with the agent tool set.

5. **`worker-configuration.d.ts` is auto-generated.** Never edit it by hand. Regenerate
   with `npm run types` (`wrangler types`) after changing bindings in `wrangler.jsonc`.

6. **Never commit** `dist/`, `node_modules/`, `.dev.vars`, or any secret values. No secret
   values belong in the repo.

7. **The live LLM only works on the deployed URL.** Local `wrangler dev` cannot read the
   remote Secrets Store, so the model call fails locally. Test the model path on the
   deployed URL via `npm run deploy`.

---

## Commands (npm)

| Command | Purpose |
| --- | --- |
| `npm run dev` | `wrangler dev` (local; no live LLM — see gotcha 7) |
| `npm run build` | `build:chat` (vite) then `build:canvas` (webpack) → `dist/` |
| `npm run build:chat` / `npm run build:canvas` | Build one bundle only |
| `npm run db:generate` | drizzle-kit generate a migration |
| `npm run db:migrate:local` / `:remote` | Apply migrations to local / remote D1 |
| `npm run types` | Regenerate `worker-configuration.d.ts` (do not edit by hand) |
| `npm run deploy` | build + `db:migrate:remote` + `wrangler deploy` |

Cloudflare facts: account_id `b3304b14848de15c72c24a14b0cd187d`; D1 `smart-architect-db`
(`database_id c27b5ef2-de79-4771-8043-9c8d170fcef4`); model `claude-opus-4-8`; gateway
`default-gateway`.

---

## Where things live

```
app/        index.js  = blueprint bus + react-planner mount + normalizeScene
            index.html, catalog/, components/, react-shim.js
chat/       React 19 assistant-ui sidebar (Vite)
            src/App.tsx, components/, debug-log.ts, globals.css, styles.css
            (Tailwind v4 with no preflight + scoped shadcn tokens)
worker/     index.ts             routes /mcp*, /agents/*, static assets (env.ASSETS, SPA fallback)
            agent/blueprint.ts   BlueprintAgent (AIChatAgent DO) + tools
            mcp/blueprint-mcp.ts BlueprintMCP (McpAgent DO) served at /mcp
            ai/anthropic.ts      Claude via AI Gateway BYOK
            blueprint/scene.ts   scene helpers (rooms, walls, holes, items, summary)
            db/{schema,versions,index}.ts + db/migrations/
src/        react-planner LIBRARY source (webpack alias: react-planner -> src/index)
docs/       react-planner library docs (HOW_TO_CREATE_*) — upstream, leave as-is
docs-site/  this app's technical docs site (served at /docs)
archive/legacy-cloudflare/  prior superseded impl — DO NOT USE
```

---

## How to add a new agent tool

1. **Add the tool to the agent.** Edit the `tools` object in `worker/agent/blueprint.ts`
   (around the `set_blueprint` / `new_room` / `add_wall` / … definitions). Use the
   `tool({ ... })` helper with a Zod input schema, mutate the scene via the helpers in
   `worker/blueprint/scene.ts`, and persist with `setState` so the change broadcasts to
   browsers.
2. **Add the scene helper if needed.** Geometry mutation logic belongs in
   `worker/blueprint/scene.ts` (e.g. `addWall`, room/hole/item builders). Keep the agent
   tool thin and the helper testable.
3. **Mirror it in MCP for parity.** Add the matching tool to `worker/mcp/blueprint-mcp.ts`
   so the Claude iOS app has the same capability. The MCP tool should proxy to the shared
   BlueprintAgent (`getScene`/`syncScene`), not maintain its own state.
4. **Versioning.** If the tool is a meaningful edit, make sure it flows through the same
   state path so the D1 `versions` DAG can capture it via the version ops.

Current tool set (keep agent and MCP in sync):

`get_blueprint`, `set_blueprint`, `clear_canvas`, `new_room`, `add_wall`, `add_hole`,
`add_item`, `remove_element`, `save_version`, `list_versions`, `restore_version`.

---

## Catalog vocabulary

react-planner elements come in three kinds, and the catalog (`app/catalog/`) defines the
valid types and their default properties:

- **Lines** — the only line `type` in use is **`wall`**. A line has two vertices and a
  list of `holes`.
- **Holes** — cut into a wall line: **`door`**, **`window`**, and similar opening types.
  A hole references its `line` and an `offset` (0..1 along the wall).
- **Items** — freestanding furniture/fixtures placed at `(x, y)` with a `rotation`
  (sofas, tables, etc.), each with a `type` from the catalog.

`normalizeScene()` fills any missing property on these elements from the catalog's
`defaultValue`, so always make sure new element types exist in the catalog before the
agent can emit them.

### Coordinate system

Centimeters; origin **top-left**; **+x right, +y down**. Default canvas **3000×2000 cm**.
Keep generated geometry inside the canvas.
