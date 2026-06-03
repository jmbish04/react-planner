import { routeAgentRequest } from 'agents';
import { BlueprintAgent } from './agent/blueprint';
import { BlueprintMCP } from './mcp/blueprint-mcp';

export { BlueprintAgent, BlueprintMCP };

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    // MCP server (Streamable HTTP) for external clients like the Claude iOS app.
    // Its tools proxy to the same BlueprintAgent instance, so edits issued from
    // iOS broadcast to the desktop browser's canvas in real time.
    if (url.pathname.startsWith('/mcp')) {
      return BlueprintMCP.serve('/mcp', { binding: 'BlueprintMCP' }).fetch(request, env, ctx);
    }

    // Agent traffic (WebSocket + HTTP) lives under /agents/*
    if (url.pathname.startsWith('/agents/')) {
      const res = await routeAgentRequest(request, env);
      return res ?? new Response('Agent not found', { status: 404 });
    }

    // Everything else is the static SPA (served from the [assets] binding).
    return env.ASSETS.fetch(request);
  },
};
