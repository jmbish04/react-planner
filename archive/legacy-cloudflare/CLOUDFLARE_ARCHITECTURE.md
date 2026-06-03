# Cloudflare Vision-Verified Layout Automation Architecture

## Overview

This implementation extends the react-planner library with a comprehensive Cloudflare-based automation environment featuring:

- **Cloudflare Workers + Durable Objects**: Stateful AI agent runtime
- **D1 Database**: SQLite-based persistence with Drizzle ORM
- **Browser Run**: Automated screenshot generation with lighting variations
- **AI Gateway**: LLM-powered design assistance
- **Cloudflare Images**: CDN-optimized image storage

## Architecture Diagram

```
                        [ Astro / React Frontend UI ]
                         │                         ▲
           (WebSockets via useAgent)       (Real-Time State Sync)
                         │                         │
                         ▼                         │
               [ FloorplanAgent Durable Object Runtime ]
              /          │                        │      \
             /           │                        │       \
  (Drizzle ORM Queries)  │             (Code Mode Execution) (Outbound multi-part fetch)
           /             ▼                        ▼         \
          v       [ AI Gateway ]        [ Browser Run Isolate ]  v
    [(D1) SQLite]        │                        │       [Cloudflare Images]
  ┌──────────────┐       ▼                        ▼
  │ - Projects   │  [@cf/meta/llama]      Headless Chrome
  │ - Revisions  │                        (2D/3D Canvas Captures)
  │ - Snapshots  │
  └──────────────┘
```

## Project Structure

```
react-planner/
├── wrangler.jsonc                      # Cloudflare Workers configuration
├── drizzle.config.ts                   # Drizzle ORM configuration
├── tsconfig.json                       # TypeScript configuration
├── src/
│   ├── backend/
│   │   ├── index.ts                    # Hono app + agent router
│   │   └── ai/
│   │       └── agents/
│   │           └── FloorplanAgent.ts   # Durable Object agent
│   ├── frontend/
│   │   └── components/
│   │       └── FloorplanStudio.tsx     # Main UI component
│   └── db/
│       └── schema.ts                   # Database schema
├── drizzle/
│   └── 0001_initial_schema.sql         # Initial migration
└── .agent/
    ├── workflows/
    │   └── implement-feature.md        # Implementation guide
    └── rules/
        └── cloudflare-architecture.json # Architecture standards
```

## Setup Instructions

### 1. Install Dependencies

```bash
# Install Cloudflare dependencies
npm install agents-sdk hono drizzle-orm puppeteer-core workers-ai-provider ai zod @cloudflare/ai-chat @assistant-ui/react @assistant-ui/react-ai-sdk

# Install dev dependencies
npm install -D wrangler drizzle-kit typescript @types/react @types/node @cloudflare/workers-types
```

### 2. Configure Cloudflare

Update `wrangler.jsonc` with your credentials:

```jsonc
{
  "vars": {
    "CLOUDFLARE_ACCOUNT_ID": "your_actual_account_id"
  }
}
```

Add secrets:

```bash
wrangler secret put IMAGES_API_TOKEN
```

### 3. Initialize Database

```bash
# Create D1 database
wrangler d1 create colby_floorplan_db

# Update database_id in wrangler.jsonc with the returned ID

# Run migrations
npm run db:migrate
```

### 4. Development

```bash
# Start local development server
npm run wrangler:dev

# Deploy to production
npm run wrangler:deploy
```

## Features

### AI-Powered Design Tools

The FloorplanAgent provides four main tools:

1. **applyMaterialAndDimensions**: Mutates layout properties (materials, colors, dimensions)
2. **commitRevisionState**: Saves immutable revision snapshots to D1
3. **revertToRevisionIndex**: Rolls back to previous layout states
4. **generateLightingSnapshots**: Captures 2D/3D renders in day/night lighting

### Database Schema

- **projects**: Tracks individual floorplan projects
- **revisions**: Version-controlled layout snapshots
- **snapshots**: Image archives with metadata (view mode, lighting)

### Frontend Components

**FloorplanStudio** provides:
- Real-time WebSocket connection to AI agent
- Live layout editor viewport
- D1 revision history browser
- Chat interface for design commands

### Browser Automation

Cloudflare Browser Run captures screenshots:
- **View Modes**: 2D wireframe, 3D rendered
- **Lighting**: Day and night environments
- **Resolution**: 1440x900 at 85% JPEG quality
- **Storage**: Automatic upload to Cloudflare Images CDN

## API Endpoints

- `GET /health` - Health check
- `GET /openapi.json` - OpenAPI specification
- `ALL /agents/*` - WebSocket agent connections

## Environment Variables

Required in `wrangler.jsonc`:
- `CLOUDFLARE_ACCOUNT_ID`: Your Cloudflare account ID
- `IMAGES_API_TOKEN`: Secret for Cloudflare Images API

## Deployment Checklist

- [ ] Configure Cloudflare account credentials
- [ ] Create D1 database and update ID
- [ ] Add IMAGES_API_TOKEN secret
- [ ] Run database migrations
- [ ] Deploy Workers application
- [ ] Verify health endpoint
- [ ] Test WebSocket connections
- [ ] Validate snapshot generation

## Technical Stack

- **Runtime**: Cloudflare Workers (V8 isolates)
- **State**: Durable Objects with persistent storage
- **Database**: D1 (SQLite) + Drizzle ORM
- **AI**: Workers AI (@cf/meta/llama-3.3-70b-instruct-fp16)
- **Browser**: Cloudflare Browser Run (Puppeteer)
- **Frontend**: React 18 + TypeScript
- **Styling**: Tailwind CSS (utility-first)
- **WebSockets**: agents-sdk for real-time sync

## License

MIT

## Contributing

See original react-planner documentation for contribution guidelines.
