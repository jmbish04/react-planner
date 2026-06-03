import { AIChatAgent } from '@cloudflare/ai-chat';
import { callable } from 'agents';
import { streamText, convertToModelMessages, tool, stepCountIs } from 'ai';
import { z } from 'zod';
import { createModel } from '../ai/anthropic';
import {
  emptyScene, addRoom, addWall, addHole, addItem, removeElement, summarize, type Scene,
} from '../blueprint/scene';
import { saveVersion, listVersions, getVersion } from '../db/versions';

export interface BlueprintState {
  scene: Scene;
  projectId: string;
  currentVersionId: string | null;
}

const CATALOG = {
  lines: ['wall'],
  holes: ['door', 'double door', 'sliding door', 'panic door', 'double panic door', 'gate', 'window', 'sash window', 'window-curtain', 'venetian-blind-window'],
  items: ['sofa', 'armchairs', 'table', 'desk', 'chairdesk', 'sedia', 'bench', 'bookcase', 'wardrobe', 'fridge', 'kitchen', 'sink', 'tv', 'monitor_pc', 'radiator-old-style', 'conditioner', 'round column', 'square column', 'cube', 'coat-hook', 'hanger', 'trash', 'image', 'text'],
  areas: ['area'],
};

function systemPrompt(scene: Scene): string {
  return `You are Smart Architect, an AI that designs and edits a 2D floorplan that renders live in a react-planner canvas and in 3D.

COORDINATE SYSTEM
- Units are centimeters. Origin (0,0) is top-left. X increases right, Y increases DOWN.
- The canvas is ${scene.width} x ${scene.height} ${scene.unit}. Keep geometry inside the canvas; grow it with clear_canvas if needed.
- Walls connect at shared corner coordinates. Always reuse the exact same (x,y) for corners that meet so walls join cleanly.

CATALOG VOCABULARY (use these exact type strings)
- wall lines: ${CATALOG.lines.join(', ')}
- holes (placed ON a wall): ${CATALOG.holes.join(', ')}
- items (furniture/fixtures): ${CATALOG.items.join(', ')}

WORKFLOW
1. Establish exterior walls first (use new_room for a rectangular footprint, or add_wall for custom shapes).
2. Add interior partition walls.
3. Add doors and windows with add_hole onto specific wall line ids (offset 0..1 along the wall).
4. Place furniture/fixtures with add_item.
- For big restructures you may call set_blueprint with a complete scene; for incremental edits prefer the granular tools.
- Inspect current geometry with get_blueprint when you need exact ids/coordinates.

After making changes, reply with a short, friendly summary of what you changed. Do not dump raw JSON at the user.

CURRENT BLUEPRINT
${summarize(scene)}`;
}

export class BlueprintAgent extends AIChatAgent<Env, BlueprintState> {
  initialState: BlueprintState = {
    scene: emptyScene(),
    projectId: 'default',
    currentVersionId: null,
  };

  private commit(next: Scene) {
    this.setState({ ...this.state, scene: next });
  }

  // Read the current canonical scene. Used by the MCP server, which proxies to
  // this same DO instance so iOS (Claude app) and the desktop browser converge
  // on one blueprint and updates broadcast to all connected clients.
  @callable()
  getScene(): Scene {
    return this.state.scene;
  }

  // Push manual canvas edits (human drawing with the mouse) up to the agent's
  // canonical state so the next chat turn reasons over the latest geometry.
  @callable()
  syncScene(scene: Scene) {
    this.setState({ ...this.state, scene });
    return { ok: true };
  }

  // ---- Version controls invoked directly by the sidebar UI (not via the LLM) ----
  @callable()
  async saveCurrentVersion(label: string) {
    const v = await saveVersion(this.env, {
      projectId: this.state.projectId,
      parentVersionId: this.state.currentVersionId,
      label: label || 'Untitled version',
      scene: this.state.scene,
    });
    this.setState({ ...this.state, currentVersionId: v.id });
    return v;
  }

  @callable()
  async getVersions() {
    return listVersions(this.env, this.state.projectId);
  }

  @callable()
  async restore(versionId: string) {
    const v = await getVersion(this.env, versionId);
    if (!v) return { ok: false as const };
    this.setState({ ...this.state, scene: v.scene, currentVersionId: v.id });
    return { ok: true as const, label: v.label };
  }

  // Clone the current version into a new branch and switch to it.
  @callable()
  async cloneCurrent(label?: string) {
    const v = await saveVersion(this.env, {
      projectId: this.state.projectId,
      parentVersionId: this.state.currentVersionId,
      label: label || 'Branch',
      scene: this.state.scene,
    });
    this.setState({ ...this.state, currentVersionId: v.id });
    return v;
  }

  async onChatMessage(onFinish: any, options?: { abortSignal?: AbortSignal }) {
    const self = this;

    const tools = {
      get_blueprint: tool({
        description: 'Return the full current blueprint scene as JSON (use to read exact element ids and coordinates).',
        inputSchema: z.object({}),
        execute: async () => ({ scene: self.state.scene, summary: summarize(self.state.scene) }),
      }),

      set_blueprint: tool({
        description: 'Replace the ENTIRE blueprint with a complete react-planner scene object. Use only for full rebuilds.',
        inputSchema: z.object({ scene: z.any().describe('A complete react-planner scene object (unit, layers, width, height, ...).') }),
        execute: async ({ scene }) => {
          self.commit(scene as Scene);
          return { ok: true, summary: summarize(self.state.scene) };
        },
      }),

      clear_canvas: tool({
        description: 'Reset to an empty blueprint. Optionally set canvas width/height in cm.',
        inputSchema: z.object({ width: z.number().optional(), height: z.number().optional() }),
        execute: async ({ width, height }) => {
          self.commit(emptyScene(width ?? self.state.scene.width, height ?? self.state.scene.height, self.state.scene.unit));
          return { ok: true, summary: 'Canvas cleared.' };
        },
      }),

      new_room: tool({
        description: 'Add a rectangular room (4 walls). x,y is the top-left corner; width and height in cm.',
        inputSchema: z.object({ x: z.number(), y: z.number(), width: z.number(), height: z.number() }),
        execute: async (args) => {
          const { scene, lineIds } = addRoom(self.state.scene, args);
          self.commit(scene);
          return { ok: true, lineIds, summary: `Added room at (${args.x},${args.y}) ${args.width}x${args.height}cm. Wall ids: ${lineIds.join(', ')}` };
        },
      }),

      add_wall: tool({
        description: 'Add one wall segment between two points (cm). Shared corners are auto-merged.',
        inputSchema: z.object({ x1: z.number(), y1: z.number(), x2: z.number(), y2: z.number() }),
        execute: async (args) => {
          const { scene, lineId } = addWall(self.state.scene, args);
          self.commit(scene);
          return { ok: true, lineId, summary: `Added wall ${lineId}: (${args.x1},${args.y1})->(${args.x2},${args.y2})` };
        },
      }),

      add_hole: tool({
        description: 'Add a door or window onto an existing wall line. type must be a valid hole type; offset is 0..1 along the wall.',
        inputSchema: z.object({
          lineId: z.string(),
          type: z.enum(CATALOG.holes as [string, ...string[]]),
          offset: z.number().min(0).max(1).optional(),
        }),
        execute: async (args) => {
          const { scene, holeId } = addHole(self.state.scene, args);
          self.commit(scene);
          return { ok: true, holeId, summary: `Added ${args.type} (${holeId}) on wall ${args.lineId}` };
        },
      }),

      add_item: tool({
        description: 'Place a furniture/fixture item at (x,y) cm with optional rotation in degrees.',
        inputSchema: z.object({
          type: z.enum(CATALOG.items as [string, ...string[]]),
          x: z.number(), y: z.number(), rotation: z.number().optional(),
        }),
        execute: async (args) => {
          const { scene, itemId } = addItem(self.state.scene, args);
          self.commit(scene);
          return { ok: true, itemId, summary: `Placed ${args.type} (${itemId}) at (${args.x},${args.y})` };
        },
      }),

      remove_element: tool({
        description: 'Remove a wall, hole, item, or vertex by its id.',
        inputSchema: z.object({ id: z.string() }),
        execute: async ({ id }) => {
          self.commit(removeElement(self.state.scene, { id }));
          return { ok: true, summary: `Removed ${id}` };
        },
      }),

      save_version: tool({
        description: 'Save the current blueprint as a named version so it can be restored later.',
        inputSchema: z.object({ label: z.string().describe('Short human label, e.g. "kitchen on north wall"') }),
        execute: async ({ label }) => {
          const v = await saveVersion(self.env, {
            projectId: self.state.projectId,
            parentVersionId: self.state.currentVersionId,
            label,
            scene: self.state.scene,
          });
          self.setState({ ...self.state, currentVersionId: v.id });
          return { ok: true, versionId: v.id, summary: `Saved version "${label}" (${v.id}).` };
        },
      }),

      list_versions: tool({
        description: 'List saved versions of this project (id, label, parent, timestamp).',
        inputSchema: z.object({}),
        execute: async () => ({ versions: await listVersions(self.env, self.state.projectId) }),
      }),

      restore_version: tool({
        description: 'Load a saved version into the canvas by its id (rollback). Does not delete later versions.',
        inputSchema: z.object({ versionId: z.string() }),
        execute: async ({ versionId }) => {
          const v = await getVersion(self.env, versionId);
          if (!v) return { ok: false, summary: `Version ${versionId} not found.` };
          self.setState({ ...self.state, scene: v.scene, currentVersionId: v.id });
          return { ok: true, summary: `Restored version "${v.label}" (${v.id}).` };
        },
      }),
    };

    const result = streamText({
      model: await createModel(this.env),
      system: systemPrompt(this.state.scene),
      messages: await convertToModelMessages(this.messages),
      tools,
      stopWhen: stepCountIs(12),
      abortSignal: options?.abortSignal,
      onFinish,
    });

    return result.toUIMessageStreamResponse();
  }
}
