import { routeAgentRequest } from 'agents';
import { BlueprintAgent } from './agent/blueprint';

export { BlueprintAgent };

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // Agent traffic (WebSocket + HTTP) lives under /agents/*
    if (url.pathname.startsWith('/agents/')) {
      const res = await routeAgentRequest(request, env);
      return res ?? new Response('Agent not found', { status: 404 });
    }

    // Everything else is the static SPA (served from the [assets] binding).
    return env.ASSETS.fetch(request);
  },
};
