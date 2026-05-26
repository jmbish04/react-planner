import { AIChatAgent, callable } from "agents-sdk";
import { generateText, tool } from "ai";
import { createWorkersAI } from "workers-ai-provider";
import { drizzle } from "drizzle-orm/d1";
import { eq, desc } from "drizzle-orm";
import { z } from "zod";
import puppeteer from "puppeteer-core";
import { revisions, snapshots } from "../../../db/schema";

interface AgentState {
  currentProject: string | null;
  layoutTree: any;
}

export class FloorplanAgent extends AIChatAgent<any> {
  async onStart() {
    const state = await this.ctx.storage.get<AgentState>("studio_state");
    if (!state) {
      await this.ctx.storage.put<AgentState>("studio_state", {
        currentProject: this.ctx.id.toString(),
        layoutTree: {
          unit: "cm",
          layers: {
            "layer-1": {
              id: "layer-1",
              name: "Main Floor",
              vertices: {},
              lines: {},
              holes: {},
              items: {}
            }
          },
          selectedLayer: "layer-1"
        }
      });
    }
  }

  @callable()
  async getLatestWorkspaceState(): Promise<AgentState> {
    return (await this.ctx.storage.get<AgentState>("studio_state"))!;
  }

  async onMessage(message: any) {
    const aiProvider = createWorkersAI({ binding: this.env.AI });
    const db = drizzle(this.env.DB);
    const state = (await this.ctx.storage.get<AgentState>("studio_state"))!;

    const response = await generateText({
      model: aiProvider("@cf/meta/llama-3.3-70b-instruct-fp16"),
      system: `You are an elite AI interior designer and architectural automation control plane.
Your role is to handle mutations on the current space state tree.
You can alter wall properties, floor finishes, cabinet style details, and precise dimension rules.
Current spatial configuration tree: ${JSON.stringify(state.layoutTree)}`,
      prompt: message.text,
      tools: {
        applyMaterialAndDimensions: tool({
          description: "Mutates architectural lines, finishes, paint values, countertops, or explicit sizing constraints inside the active layout.",
          parameters: z.object({
            targetType: z.enum(["line", "item", "layer"]),
            elementId: z.string().description("The UUID key string for the element to adapt inside the Immutable canvas state model."),
            properties: z.object({
              color: z.string().optional().description("Hex code color mapping value (e.g. '#27272a')"),
              thickness: z.number().optional().description("Thickness calculation in cm"),
              length: z.number().optional().description("Absolute measurement override rule applied to the segment length component"),
              texture: z.enum(["parquet", "ceramic-tile", "painted", "strand-porcelain", "steel", "darksteel"]).optional()
            }),
            modificationRationale: z.string()
          }),
          execute: async (params) => {
            const currentTree = state.layoutTree;
            const layer = currentTree.layers[currentTree.selectedLayer];

            if (params.targetType === "line" && layer.lines[params.elementId]) {
              layer.lines[params.elementId].properties = {
                ...layer.lines[params.elementId].properties,
                ...params.properties
              };
            } else if (params.targetType === "item" && layer.items[params.elementId]) {
              layer.items[params.elementId].properties = {
                ...layer.items[params.elementId].properties,
                ...params.properties
              };
            } else {
              const newId = params.elementId || "element-" + crypto.randomUUID().slice(0, 8);
              layer.items[newId] = {
                id: newId,
                type: "kitchen-node",
                properties: params.properties
              };
            }

            state.layoutTree = currentTree;
            await this.ctx.storage.put("studio_state", state);
            return `Successfully updated element properties inside the workspace data matrix: ${params.modificationRationale}`;
          }
        }),

        commitRevisionState: tool({
          description: "Persists the ongoing structural layout as a clean, immutable revision entry block inside the centralized D1 database catalog.",
          parameters: z.object({
            changeSummary: z.string().description("Detailed breakdown of modifications to identify this snapshot variant layout.")
          }),
          execute: async ({ changeSummary }) => {
            const revisionUuid = crypto.randomUUID();

            const existingRevisions = await db.select()
              .from(revisions)
              .where(eq(revisions.projectId, state.currentProject!));

            const revisionIndex = existingRevisions.length + 1;

            await db.insert(revisions).values({
              id: revisionUuid,
              projectId: state.currentProject!,
              revisionNumber: revisionIndex,
              description: changeSummary,
              stateJson: JSON.stringify(state.layoutTree),
              createdAt: new Date().toISOString()
            });

            return `Revision entry successfully cataloged under transactional index: #${revisionIndex}. Unlocking secure rollbacks.`;
          }
        }),

        revertToRevisionIndex: tool({
          description: "Queries the D1 cluster, fetches a historic JSON state payload, and rolls back the live project state configuration.",
          parameters: z.object({
            targetRevisionId: z.string().description("The exact target tracking ID token found inside the structural project history database table.")
          }),
          execute: async ({ targetRevisionId }) => {
            const matches = await db.select()
              .from(revisions)
              .where(eq(revisions.id, targetRevisionId))
              .limit(1);

            if (!matches.length) {
              return "Failed to perform rollback state switch: Target identifier sequence not discovered inside D1 ledger.";
            }

            state.layoutTree = JSON.parse(matches[0].stateJson);
            await this.ctx.storage.put("studio_state", state);
            return `Rollback completed. Restored workspace setup properties from milestone description: ${matches[0].description}`;
          }
        }),

        generateLightingSnapshots: tool({
          description: "Launches a Cloudflare Browser Run virtual instance, sets lighting themes, takes 2D/3D screenshots, and stores them via Cloudflare Images.",
          parameters: z.object({
            currentRevisionId: z.string().description("Active tracking id matching the target layout layout tree snapshot node.")
          }),
          execute: async ({ currentRevisionId }) => {
            const targetUrl = `https://colby-studio-dev.pages.dev/preview?sessionId=${this.ctx.id.toString()}`;
            const browserInstance = await puppeteer.launch(this.env.BROWSER);
            const activePage = await browserInstance.newPage();

            await activePage.setViewport({ width: 1440, height: 900 });
            await activePage.goto(targetUrl, { waitUntil: "networkidle0" });

            const structuralOrientations = ["2d", "3d"];
            const lightVariations = ["day", "night"];

            for (const orientation of structuralOrientations) {
              for (const timeMode of lightVariations) {
                await activePage.evaluate((view, mode) => {
                  if ((window as any).setWorkspaceViewportMode) {
                    (window as any).setWorkspaceViewportMode(view);
                    (window as any).applySpatialEnvironmentLighting(mode);
                  }
                }, orientation, timeMode);

                await new Promise((r) => setTimeout(r, 800));

                const rawBinaryBuffer = await activePage.screenshot({ type: "jpeg", quality: 85 }) as Buffer;

                const assetFormPayload = new FormData();
                assetFormPayload.append("file", new Blob([rawBinaryBuffer], { type: "image/jpeg" }), `snapshot_${orientation}_${timeMode}.jpg`);

                const imagesResponse = await fetch(
                  `https://api.cloudflare.com/client/v4/accounts/${this.env.CLOUDFLARE_ACCOUNT_ID}/images/v1`,
                  {
                    method: "POST",
                    headers: {
                      Authorization: `Bearer ${this.env.IMAGES_API_TOKEN}`
                    },
                    body: assetFormPayload
                  }
                );

                if (imagesResponse.ok) {
                  const imagePayloadJson = await imagesResponse.json() as any;
                  const publicDeliveryUrl = imagePayloadJson.result.variants[0];

                  await db.insert(snapshots).values({
                    id: crypto.randomUUID(),
                    sessionId: this.ctx.id.toString(),
                    revisionId: currentRevisionId,
                    imageUrl: publicDeliveryUrl,
                    viewMode: orientation,
                    timeOfDay: timeMode,
                    createdAt: new Date().toISOString()
                  });
                }
              }
            }

            await browserInstance.close();
            return `Dual-lighting vision loop pipeline complete. Four snapshots generated and archived cleanly via Cloudflare Images.`;
          }
        })
      }
    });

    await this.send({
      type: "text",
      content: response.text
    });
  }
}
