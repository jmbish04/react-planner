# Cloudflare React Planner AI

A Cloudflare-native application that hosts **react-planner** (a React/Redux/Three.js floor planning tool) within Cloudflare Containers and enables AI agents to modify the planner's state based on natural language prompts.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     User / Client                            │
└──────────────────────┬──────────────────────────────────────┘
                       │ HTTP/REST API
                       ▼
┌─────────────────────────────────────────────────────────────┐
│         Cloudflare Worker (agent-gateway-worker)             │
│  - Natural Language Processing (Workers AI)                  │
│  - Request Routing                                           │
│  - Session Management                                        │
└──────────────────────┬──────────────────────────────────────┘
                       │
        ┌──────────────┼──────────────┐
        ▼              ▼              ▼
┌──────────────┐ ┌──────────┐ ┌────────────┐
│ Durable      │ │ Queues   │ │ R2 Storage │
│ Objects      │ │          │ │            │
│ (Sessions)   │ │          │ │            │
└──────┬───────┘ └──────────┘ └────────────┘
       │
       │ Container Binding
       ▼
┌─────────────────────────────────────────────────────────────┐
│         Cloudflare Container (react-planner-container)       │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Headless Browser (Puppeteer + Chromium)             │   │
│  │  ┌────────────────────────────────────────────────┐  │   │
│  │  │  React Planner Application                     │  │   │
│  │  │  - Redux Store                                 │  │   │
│  │  │  - 2D/3D Rendering (Three.js)                  │  │   │
│  │  └────────────────────────────────────────────────┘  │   │
│  └──────────────────────────────────────────────────────┘   │
│  Express Server - Command API                                │
│  - /action - Dispatch Redux actions                          │
│  - /command - High-level commands                            │
│  - /state - Get current state                                │
│  - /screenshot - Capture view                                │
└─────────────────────────────────────────────────────────────┘
```

## Components

### 1. Cloudflare Container (`container/`)

A Docker container running:
- **Node.js 18** runtime
- **Chromium** headless browser via Puppeteer
- **Express.js** server exposing command API
- **React Planner** demo application (built)

**Key Files:**
- `Dockerfile` - Container definition
- `server.js` - Express server with Puppeteer control
- `package.json` - Container dependencies
- `store-exposer.js` - Script to expose Redux store to Puppeteer
- `renderer-patch.js` - Patch instructions for react-planner

### 2. Cloudflare Worker (`worker/`)

The main gateway handling:
- Natural language processing via **Workers AI**
- Session management via **Durable Objects**
- Asynchronous tasks via **Queues**
- Plan persistence via **R2 Storage**

**Key Files:**
- `wrangler.toml` - Cloudflare configuration
- `src/index.js` - Main worker entry point
- `src/durable-object.js` - PlannerSessionDO class
- `src/agent-helper.js` - AI prompt parsing
- `package.json` - Worker dependencies

## Setup Instructions

### Prerequisites

1. **Cloudflare Account** with:
   - Workers Paid Plan (for Durable Objects)
   - Access to Cloudflare Containers (Beta)
   - Workers AI enabled

2. **Local Development Tools:**
   - Node.js 18+
   - npm or pnpm
   - Docker & Docker Compose
   - Wrangler CLI: `npm install -g wrangler`

3. **Authenticate Wrangler:**
   ```bash
   wrangler login
   ```

### Step 1: Build React Planner Demo

First, build the react-planner demo application:

```bash
# From the root of react-planner repository
cd ../../react-planner # Assuming cloudflare-planner is a sibling of the main repo

# Install dependencies
npm install

# Build the demo
npm run build-demo
```

This creates the built files in `demo/dist/`.

### Step 2: Patch React Planner to Expose Redux Store

To allow Puppeteer to control the planner, modify `demo/src/renderer.jsx`:

```javascript
// After creating the store (around line 45-66), add:
if (typeof window !== 'undefined') {
  window.__REDUX_STORE__ = store;
  window.__PLANNER_STORE__ = store;
  console.log('Redux store exposed');
}
```

Then rebuild:
```bash
npm run build-demo
```

**Alternative:** See `cloudflare-planner/container/renderer-patch.js` for a complete modified version.

### Step 3: Build and Test Container Locally

```bash
cd cloudflare-planner/container

# Copy built demo files
mkdir -p demo/dist
cp -r ../../demo/dist/* demo/dist/

# Install dependencies
npm install

# Build Docker image
docker build -t react-planner-container .

# Test locally (development mode - no auth required)
docker run -p 8080:8080 react-planner-container

# Test locally with authentication (production mode)
docker run -p 8080:8080 \
  -e NODE_ENV=production \
  -e WORKER_API_KEY=your-secret-api-key \
  react-planner-container

# In another terminal, test the API:
curl http://localhost:8080/health
curl http://localhost:8080/state
curl -X POST http://localhost:8080/command \
  -H "Content-Type: application/json" \
  -d '{"command": "MODE_3D", "params": {}}'
```

### Step 4: Deploy Container to Cloudflare

```bash
# Tag for Cloudflare Container Registry
docker tag react-planner-container:latest \
  registry.cloudflare.com/<YOUR_ACCOUNT_ID>/react-planner-container:latest

# Push to Cloudflare
docker push registry.cloudflare.com/<YOUR_ACCOUNT_ID>/react-planner-container:latest

# Note the container ID from the output
```

### Step 5: Configure Worker

Edit `worker/wrangler.toml`:

1. **Update container binding:**
   ```toml
   [[container_bindings]]
   name = "PLANNER_CONTAINER"
   # Add your container ID here:
   container_id = "your-container-id-from-step-4"
   ```

2. **Create KV namespace:**
   ```bash
   cd worker
   wrangler kv:namespace create "PLANNER_METADATA"
   # Copy the ID and update wrangler.toml
   ```

3. **Create R2 bucket:**
   ```bash
   wrangler r2 bucket create react-planner-storage
   ```

4. **Create Queue:**
   ```bash
   wrangler queues create planner-tasks-queue
   ```

### Step 6: Deploy Worker

```bash
cd cloudflare-planner/worker

# Install dependencies
npm install

# Deploy
wrangler deploy

# Note your worker URL (e.g., https://react-planner-agent-gateway.your-subdomain.workers.dev)
```

## API Usage

### Base URL
```
https://react-planner-agent-gateway.your-subdomain.workers.dev
```

### Endpoints

#### 1. Health Check
```bash
GET /health

Response:
{
  "status": "healthy",
  "service": "react-planner-agent-gateway",
  "timestamp": 1234567890
}
```

#### 2. AI-Powered Modification
```bash
POST /modify

Body:
{
  "sessionId": "user-session-123",
  "prompt": "Add a sofa in the middle of the living room",
  "includeState": true
}

Response:
{
  "success": true,
  "interpretation": {
    "command": "ADD_ITEM",
    "params": {
      "itemType": "sofa",
      "position": { "x": 150, "y": 200 }
    },
    "reasoning": "Detected request to add sofa"
  },
  "result": { ... }
}
```

#### 3. Direct Command (No AI)
```bash
POST /command

Body:
{
  "sessionId": "user-session-123",
  "command": "MODE_3D",
  "params": {}
}

Response:
{
  "success": true,
  "result": { ... }
}
```

#### 4. Get Current State
```bash
GET /session/{sessionId}/state

Response:
{
  "success": true,
  "state": {
    "react-planner": { ... }
  }
}
```

#### 5. Take Screenshot
```bash
GET /screenshot?sessionId=user-session-123

Response:
{
  "success": true,
  "screenshot": "base64-encoded-image..."
}
```

#### 6. Save Plan
```bash
POST /save

Body:
{
  "sessionId": "user-session-123",
  "planId": "my-floor-plan"
}

Response:
{
  "success": true,
  "planId": "my-floor-plan",
  "key": "plans/my-floor-plan.json"
}
```

#### 7. Load Plan
```bash
POST /load

Body:
{
  "sessionId": "user-session-123",
  "planId": "my-floor-plan"
}

Response:
{
  "success": true,
  "result": { ... }
}
```

## Example Usage

### JavaScript/TypeScript Client

```javascript
const WORKER_URL = 'https://react-planner-agent-gateway.your-subdomain.workers.dev';
const sessionId = 'user-' + Math.random().toString(36).substring(7);

// Modify with natural language
async function modifyPlanner(prompt) {
  const response = await fetch(`${WORKER_URL}/modify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId, prompt })
  });
  return await response.json();
}

// Example: Add furniture
const result = await modifyPlanner('Add a blue sofa in the center');
console.log(result);

// Get current state
const state = await fetch(`${WORKER_URL}/session/${sessionId}/state`)
  .then(r => r.json());
console.log(state);

// Take a screenshot
const screenshot = await fetch(`${WORKER_URL}/screenshot?sessionId=${sessionId}`)
  .then(r => r.json());
console.log('Screenshot:', screenshot.screenshot);
```

### CURL Examples

```bash
# Create session and add items
SESSION_ID="demo-session-1"
WORKER_URL="https://react-planner-agent-gateway.your-subdomain.workers.dev"

# Add furniture with AI
curl -X POST $WORKER_URL/modify \
  -H "Content-Type: application/json" \
  -d "{\"sessionId\": \"$SESSION_ID\", \"prompt\": \"Add a dining table and 4 chairs\"}"

# Switch to 3D view
curl -X POST $WORKER_URL/command \
  -H "Content-Type: application/json" \
  -d "{\"sessionId\": \"$SESSION_ID\", \"command\": \"MODE_3D\", \"params\": {}}"

# Save the plan
curl -X POST $WORKER_URL/save \
  -H "Content-Type: application/json" \
  -d "{\"sessionId\": \"$SESSION_ID\", \"planId\": \"my-room-design\"}"

# Get screenshot
curl "$WORKER_URL/screenshot?sessionId=$SESSION_ID" | jq -r '.screenshot' | base64 -d > plan.png
```

## Available Commands

The system supports these high-level commands:

| Command | Description | Parameters |
|---------|-------------|------------|
| `ADD_ITEM` | Add furniture/objects | `itemType`: string, `position`: {x, y} (optional) |
| `ADD_WALL` | Draw a wall | Start/end points (if provided) |
| `MODE_2D` | Switch to 2D view | None |
| `MODE_3D` | Switch to 3D view | None |
| `LOAD_PROJECT` | Load saved plan | `sceneJSON`: object |

### Available Item Types

Common furniture items you can add:
- `sofa`, `chair`, `table`, `desk`, `bed`
- `bookcase`, `wardrobe`, `fridge`, `sink`
- `tv`, `kitchen`, `balcony`, `column`
- Many more (see `demo/src/catalog/` for full list)

## Architecture Details

### Actor Pattern with Durable Objects

Each user session/plan is managed by a **Durable Object** instance:
- Consistent state per session
- Manages lifecycle of associated container instance
- Handles all interactions with the container
- Persists metadata and modification history

### Container Sleep/Wake

Containers automatically:
- **Sleep** after 60 seconds of inactivity
- **Wake** on next request (transparent to user)
- Preserve state during sleep

### AI Integration

The system uses **Cloudflare Workers AI** (`@cf/meta/llama-3-8b-instruct`) to:
1. Parse natural language prompts
2. Extract intent and parameters
3. Map to structured commands
4. Includes fallback rule-based parsing

### Asynchronous Processing

**Cloudflare Queues** handle:
- Auto-save operations
- Batch command execution
- Background tasks
- Retry logic for failed operations

## Development

### Local Development

```bash
# Worker development with hot reload
cd worker
wrangler dev

# Container development
cd container
npm start
# or with Docker
docker-compose up
```

### Testing

```bash
# Worker tests
cd worker
npm test

# Container tests
cd container
npm test
```

### Logs

```bash
# View worker logs
wrangler tail

# View Durable Object logs
wrangler tail --format pretty

# Container logs
docker logs <container-id>
```

## Troubleshooting

### Redux Store Not Accessible

**Symptom:** Container returns "Redux store not accessible" error

**Solution:**
1. Apply `container/renderer-patch.js` to `demo/src/renderer.jsx`
2. Rebuild the demo: `npm run build-demo`
3. Redeploy the container

### Container Fails to Start

**Symptom:** Health check fails or container exits

**Solution:**
1. Check container logs: `docker logs <container-id>`
2. Verify planner files exist in `planner-dist/`
3. Ensure Chromium dependencies are installed
4. Try locally: `docker run -it react-planner-container /bin/bash`

### AI Parsing Issues

**Symptom:** AI doesn't understand prompts

**Solution:**
- Be more specific: "Add a red sofa at position 100, 200"
- Use recognized furniture names (see catalog)
- System falls back to rule-based parsing automatically

### Durable Object Errors

**Symptom:** "Durable Object is over its CPU limit"

**Solution:**
- Use Queues for long-running operations
- Batch multiple commands together
- Increase sleep timeout for containers

## Security

### Container Authentication

The container server includes built-in API key authentication for sensitive endpoints.

**Protected Endpoints:**
- `/execute` - Arbitrary JavaScript execution (requires authentication)

**Public Endpoints:**
- `/health` - Health check
- `/state` - Get current state
- `/action` - Dispatch Redux actions
- `/command` - High-level commands
- `/screenshot` - Capture screenshots

**Configuration:**

1. **Development Mode** (default):
   - No WORKER_API_KEY required
   - Authentication bypassed with warning
   - Use for local testing only

2. **Production Mode**:
   - Set `NODE_ENV=production`
   - Set `WORKER_API_KEY` environment variable
   - All requests to protected endpoints require `Authorization: Bearer <api-key>` header

**Example with Authentication:**
```bash
# Set API key in container environment
export WORKER_API_KEY="your-secure-random-api-key-here"

# Make authenticated request
curl -X POST http://localhost:8080/execute \
  -H "Authorization: Bearer your-secure-random-api-key-here" \
  -H "Content-Type: application/json" \
  -d '{"script": "return window.__PLANNER_API__.getState();"}'
```

**Security Features:**
- Constant-time string comparison prevents timing attacks
- SHA-256 hashing for token validation
- Clear error messages for debugging
- Production enforcement of WORKER_API_KEY

### Input Validation

**Item Type Validation:**

The `ADD_ITEM` command validates item types against the catalog:

```javascript
// Valid item types
const VALID_ITEM_TYPES = [
  'sofa', 'chair', 'table', 'desk', 'bed', 'bookcase', 'wardrobe', 'fridge',
  'sink', 'tv', 'kitchen', 'balcony', 'column', 'column-square', 'cube',
  // ... and more
];
```

Invalid item types return a 400 error with available options:
```json
{
  "success": false,
  "error": "Invalid itemType: \"invalid\". Must be one of: sofa, chair, table, ...",
  "availableTypes": ["sofa", "chair", "table", ...]
}
```

## Production Considerations

### Performance

- Container cold starts: ~2-5 seconds
- Container warm: <100ms response time
- Durable Objects: Regional affinity for low latency
- Consider using Workflows for complex multi-step operations

### Scaling

- Each Durable Object = 1 session/plan
- Containers auto-scale per session
- Queue-based processing prevents overload
- R2 provides unlimited plan storage

### Security Best Practices

- **Always set WORKER_API_KEY in production** for container authentication
- Implement additional authentication/authorization in the Worker layer
- Rate limiting per user
- Validate all commands before execution
- Sanitize natural language inputs
- Use Cloudflare Access for admin endpoints
- Rotate API keys regularly
- Use secrets management (Cloudflare Secrets, environment variables)

### Cost Optimization

- Configure container sleep aggressively
- Use cache for frequently accessed plans
- Batch AI requests where possible
- Monitor and set usage limits

## Future Enhancements

- [ ] Cloudflare Workflows for multi-step agent operations
- [ ] Real-time collaboration via Durable Objects WebSockets
- [ ] Integration with Cloudflare Images for optimized screenshots
- [ ] Advanced AI models for better intent understanding
- [ ] Voice input via Speech-to-Text
- [ ] Export to various formats (PDF, DWG, etc.)
- [ ] Integration with 3D model libraries

## License

This Cloudflare integration wrapper is provided as-is. React Planner is licensed under MIT.

## Support

For issues related to:
- **React Planner**: https://github.com/cvdlab/react-planner/issues
- **Cloudflare Workers**: https://developers.cloudflare.com/workers/
- **This Integration**: Open an issue in your repository

---

Built with Cloudflare Workers, Durable Objects, Containers, Workers AI, Queues, and R2.
