import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { McpAgent } from 'agents/mcp';
import { getAgentByName } from 'agents';
import { z } from 'zod';
import { addRoom, addWall, addHole, addItem, removeElement, addLayer, renameLayer, setAreaFloor, emptyScene, summarize, type Scene } from '../blueprint/scene';

const HOLE_TYPES = [
  'door', 'double door', 'sliding door', 'panic door', 'double panic door',
  'gate', 'window', 'sash window', 'window-curtain', 'venetian-blind-window',
] as const;

const ITEM_TYPES = [
  'sofa', 'armchairs', 'table', 'desk', 'chairdesk', 'sedia', 'bench', 'bookcase',
  'wardrobe', 'fridge', 'kitchen', 'sink', 'tv', 'monitor_pc', 'radiator-old-style',
  'conditioner', 'round column', 'square column', 'cube', 'coat-hook', 'hanger',
  'trash', 'image', 'text',
  // Remodel components (this home's finishes)
  'calacatta-viola-countertop', 'calacatta-viola-backsplash', 'walnut-base-cabinet',
  'track-light-black', 'wall-sconce', 'closet-stacked',
  // Circulation
  'switchback-stair', 'stair-opening',
] as const;

const text = (t: string) => ({ content: [{ type: 'text' as const, text: t }] });

/**
 * MCP server exposed at /mcp. Every tool proxies to the BlueprintAgent Durable
 * Object instance "default" (the same one the desktop browser is connected to
 * over WebSocket). Mutating it via syncScene broadcasts to all connected
 * clients, so a prompt issued from the Claude iOS app appears on the desktop
 * canvas in real time.
 */
export class BlueprintMCP extends McpAgent<Env> {
  server = new McpServer({ name: 'smart-architect', version: '1.0.0' });

  private async agent() {
    return getAgentByName(this.env.BlueprintAgent, 'default');
  }
  private async scene(): Promise<Scene> {
    return (await this.agent()).getScene();
  }
  private async push(next: Scene) {
    await (await this.agent()).syncScene(next);
  }

  async init() {
    this.server.registerTool(
      'get_blueprint',
      { description: 'Read the current floorplan: walls, doors/windows, and items with their ids and coordinates (cm).', inputSchema: {} },
      async () => text(summarize(await this.scene()))
    );

    this.server.registerTool(
      'new_room',
      {
        description: 'Add a rectangular room (4 walls). x,y is the top-left corner; width and height in cm. Origin top-left, +x right, +y down.',
        inputSchema: { x: z.number(), y: z.number(), width: z.number(), height: z.number() },
      },
      async ({ x, y, width, height }) => {
        const { scene, lineIds } = addRoom(await this.scene(), { x, y, width, height });
        await this.push(scene);
        return text(`Added room at (${x},${y}) ${width}x${height}cm. Wall ids: ${lineIds.join(', ')}`);
      }
    );

    this.server.registerTool(
      'add_wall',
      {
        description: 'Add one wall segment between two points (cm). Shared corners auto-merge.',
        inputSchema: { x1: z.number(), y1: z.number(), x2: z.number(), y2: z.number() },
      },
      async ({ x1, y1, x2, y2 }) => {
        const { scene, lineId } = addWall(await this.scene(), { x1, y1, x2, y2 });
        await this.push(scene);
        return text(`Added wall ${lineId}: (${x1},${y1})->(${x2},${y2})`);
      }
    );

    this.server.registerTool(
      'add_hole',
      {
        description: 'Add a door or window onto an existing wall line id. offset is 0..1 along the wall (0.5 = centered).',
        inputSchema: { lineId: z.string(), type: z.enum(HOLE_TYPES), offset: z.number().min(0).max(1).optional() },
      },
      async ({ lineId, type, offset }) => {
        const { scene, holeId } = addHole(await this.scene(), { lineId, type, offset });
        await this.push(scene);
        return text(`Added ${type} (${holeId}) on wall ${lineId}`);
      }
    );

    this.server.registerTool(
      'add_item',
      {
        description: 'Place a furniture/fixture item at (x,y) cm with optional rotation in degrees.',
        inputSchema: { type: z.enum(ITEM_TYPES), x: z.number(), y: z.number(), rotation: z.number().optional() },
      },
      async ({ type, x, y, rotation }) => {
        const { scene, itemId } = addItem(await this.scene(), { type, x, y, rotation });
        await this.push(scene);
        return text(`Placed ${type} (${itemId}) at (${x},${y})`);
      }
    );

    this.server.registerTool(
      'remove_element',
      { description: 'Remove a wall, hole, or item by its id.', inputSchema: { id: z.string() } },
      async ({ id }) => {
        await this.push(removeElement(await this.scene(), { id }));
        return text(`Removed ${id}`);
      }
    );

    this.server.registerTool(
      'create_layer',
      { description: 'Create a new building level/layer and make it active (subsequent walls/rooms go onto it). One layer per floorplan level.', inputSchema: { name: z.string(), altitude: z.number().optional() } },
      async ({ name, altitude }) => {
        const { scene, layerId } = addLayer(await this.scene(), { name, altitude });
        await this.push(scene);
        return text(`Created layer "${name}" (${layerId}), now active.`);
      }
    );

    this.server.registerTool(
      'rename_layer',
      { description: 'Rename the active (or specified) layer.', inputSchema: { name: z.string(), layerId: z.string().optional() } },
      async ({ name, layerId }) => {
        await this.push(renameLayer(await this.scene(), { name, layerId }));
        return text(`Renamed layer to "${name}".`);
      }
    );

    this.server.registerTool(
      'set_floor',
      {
        description: 'Set the floor material of named room(s). material e.g. "dark walnut", "white oak", "tile". Scope by room name (area) or level "upper"/"lower"/"all".',
        inputSchema: { material: z.string(), area: z.string().optional(), level: z.enum(['upper', 'lower', 'all']).optional() },
      },
      async ({ material, area, level }) => {
        const { scene, changed } = setAreaFloor(await this.scene(), { material, area, level });
        await this.push(scene);
        return text(changed.length ? `Set ${material} floor on: ${changed.join(', ')}.` : 'No matching rooms.');
      }
    );

    this.server.registerTool(
      'set_blueprint',
      {
        description: 'Replace the ENTIRE blueprint with a complete react-planner scene object. Use only for full rebuilds.',
        inputSchema: { scene: z.any() },
      },
      async ({ scene }) => {
        await this.push(scene as Scene);
        return text(summarize(scene as Scene));
      }
    );

    this.server.registerTool(
      'clear_canvas',
      { description: 'Reset to an empty blueprint. Optionally set canvas width/height in cm.', inputSchema: { width: z.number().optional(), height: z.number().optional() } },
      async ({ width, height }) => {
        const cur = await this.scene();
        await this.push(emptyScene(width ?? cur.width, height ?? cur.height, cur.unit));
        return text('Canvas cleared.');
      }
    );

    this.server.registerTool(
      'save_version',
      { description: 'Save the current blueprint as a named version (for rollback/clone later).', inputSchema: { label: z.string() } },
      async ({ label }) => {
        const v = await (await this.agent()).saveCurrentVersion(label);
        return text(`Saved version "${label}" (${v.id}).`);
      }
    );

    this.server.registerTool(
      'list_versions',
      { description: 'List saved versions of the project (id, label, timestamp).', inputSchema: {} },
      async () => {
        const versions = await (await this.agent()).getVersions();
        return text(JSON.stringify(versions, null, 2));
      }
    );

    this.server.registerTool(
      'restore_version',
      { description: 'Load a saved version into the canvas by id (rollback). Does not delete later versions.', inputSchema: { versionId: z.string() } },
      async ({ versionId }) => {
        const res = await (await this.agent()).restore(versionId);
        return text(res.ok ? `Restored version ${versionId}.` : `Version ${versionId} not found.`);
      }
    );
  }
}
