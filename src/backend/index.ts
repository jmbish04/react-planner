import { Hono } from "hono";
import { routeAgentRequest } from "agents-sdk";

type Env = {
  FloorplanAgent: DurableObjectNamespace;
  DB: D1Database;
  AI: any;
  BROWSER: any;
  CLOUDFLARE_ACCOUNT_ID: string;
  IMAGES_API_TOKEN: string;
};

const app = new Hono<{ Bindings: Env }>();

app.get("/health", (c) => {
  return c.json({ status: "healthy", timestamp: new Date().toISOString() });
});

app.get("/openapi.json", (c) => {
  return c.json({
    openapi: "3.1.0",
    info: {
      title: "Colby Floorplan Studio Orchestration Service",
      version: "1.0.0",
      description: "Automated engine mapping semantic blueprint updates into Immutable layout structures"
    },
    paths: {}
  });
});

app.all("/agents/*", async (c) => {
  return await routeAgentRequest(c.env, c.req.raw);
});

export default app;
export { FloorplanAgent } from "./ai/agents/FloorplanAgent";
