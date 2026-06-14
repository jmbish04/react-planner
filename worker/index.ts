import { routeAgentRequest, getAgentByName } from 'agents';
import { BlueprintAgent } from './agent/blueprint';
import { BlueprintMCP } from './mcp/blueprint-mcp';
import { renderSceneSvg } from './blueprint/render-svg';
import { svgToPng } from './blueprint/render-png';
import { baseScene } from './blueprint/base-scene';

export { BlueprintAgent, BlueprintMCP };

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    // Top-down PNG/SVG render of the current blueprint (?level=lower|upper, ?src=base
    // renders the Core Base directly without touching the live DO, ?format=svg).
    if (url.pathname === '/render') {
      const level = url.searchParams.get('level') || 'lower';
      const layerId = level === 'upper' ? 'upper_level' : 'lower_level';
      const scene = url.searchParams.get('src') === 'base'
        ? baseScene()
        : await (await getAgentByName(env.BlueprintAgent, 'default')).getScene();
      const { svg } = renderSceneSvg(scene, layerId);
      if (url.searchParams.get('format') === 'svg') return new Response(svg, { headers: { 'content-type': 'image/svg+xml' } });
      const png = await svgToPng(svg);
      return new Response(png as unknown as BodyInit, { headers: { 'content-type': 'image/png', 'cache-control': 'no-store' } });
    }

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
