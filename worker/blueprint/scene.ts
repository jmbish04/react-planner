// react-planner "scene" document model + pure transforms.
// This is the canonical blueprint the agent and the human both edit.
// Shape matches what react-planner's `loadProject(sceneJSON)` expects.

export interface Vertex { id: string; x: number; y: number; lines: string[]; areas: string[] }
export interface Line { id: string; type: string; vertices: [string, string]; holes: string[]; properties?: Record<string, unknown>; selected?: boolean }
export interface Hole { id: string; type: string; line: string; offset: number; properties?: Record<string, unknown>; selected?: boolean }
export interface Item { id: string; type: string; x: number; y: number; rotation: number; properties?: Record<string, unknown>; selected?: boolean }
export interface Layer {
  id: string; name: string; altitude: number; order: number; opacity: number; visible: boolean;
  vertices: Record<string, Vertex>;
  lines: Record<string, Line>;
  holes: Record<string, Hole>;
  areas: Record<string, unknown>;
  items: Record<string, Item>;
  selected: { vertices: string[]; lines: string[]; holes: string[]; items: string[]; areas: string[] };
}
export interface Scene {
  unit: string;
  layers: Record<string, Layer>;
  selectedLayer: string;
  width: number;
  height: number;
  meta: Record<string, unknown>;
  guides: { horizontal: Record<string, unknown>; vertical: Record<string, unknown>; circular?: Record<string, unknown> };
}

const VERTEX_EPSILON = 1; // cm — corners within this distance are treated as the same vertex

function uid(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

export function emptyScene(width = 3000, height = 2000, unit = 'cm'): Scene {
  const layerId = 'layer-1';
  return {
    unit,
    width,
    height,
    meta: {},
    guides: { horizontal: {}, vertical: {}, circular: {} },
    selectedLayer: layerId,
    layers: {
      [layerId]: {
        id: layerId, name: 'default', altitude: 0, order: 0, opacity: 1, visible: true,
        vertices: {}, lines: {}, holes: {}, areas: {}, items: {},
        selected: { vertices: [], lines: [], holes: [], items: [], areas: [] },
      },
    },
  };
}

export function clone(scene: Scene): Scene {
  return JSON.parse(JSON.stringify(scene));
}

function getLayer(scene: Scene, layerId?: string): Layer {
  const id = layerId || scene.selectedLayer || Object.keys(scene.layers)[0];
  const layer = scene.layers[id];
  if (!layer) throw new Error(`Layer "${id}" not found`);
  return layer;
}

/**
 * Create a new layer (e.g. one per building level) and select it. Used by the
 * floorplan-image tracing flow, where each uploaded level becomes its own layer
 * stacked by altitude.
 */
export function addLayer(scene: Scene, args: { name: string; altitude?: number }): { scene: Scene; layerId: string } {
  const next = clone(scene);
  const layerId = uid('layer');
  const order = Object.keys(next.layers).length;
  next.layers[layerId] = {
    id: layerId,
    name: args.name,
    altitude: args.altitude ?? order * 300,
    order,
    opacity: 1,
    visible: true,
    vertices: {}, lines: {}, holes: {}, areas: {}, items: {},
    selected: { vertices: [], lines: [], holes: [], items: [], areas: [] },
  } as Layer;
  next.selectedLayer = layerId;
  return { scene: next, layerId };
}

/** Rename an existing layer (e.g. label the default layer "lower level"). */
export function renameLayer(scene: Scene, args: { layerId?: string; name: string }): Scene {
  const next = clone(scene);
  const layer = getLayer(next, args.layerId);
  layer.name = args.name;
  return next;
}

function findOrCreateVertex(layer: Layer, x: number, y: number): string {
  for (const v of Object.values(layer.vertices)) {
    if (Math.abs(v.x - x) <= VERTEX_EPSILON && Math.abs(v.y - y) <= VERTEX_EPSILON) return v.id;
  }
  const id = uid('v');
  layer.vertices[id] = { id, x, y, lines: [], areas: [] };
  return id;
}

/** Add a single wall segment between two points, reusing existing corner vertices. */
export function addWall(
  scene: Scene,
  args: { x1: number; y1: number; x2: number; y2: number; type?: string; layerId?: string; properties?: Record<string, unknown> }
): { scene: Scene; lineId: string } {
  const next = clone(scene);
  const layer = getLayer(next, args.layerId);
  const v1 = findOrCreateVertex(layer, args.x1, args.y1);
  const v2 = findOrCreateVertex(layer, args.x2, args.y2);
  const lineId = uid('l');
  layer.lines[lineId] = {
    id: lineId, type: args.type || 'wall', vertices: [v1, v2], holes: [],
    properties: args.properties || {}, selected: false,
  };
  layer.vertices[v1].lines.push(lineId);
  layer.vertices[v2].lines.push(lineId);
  return { scene: next, lineId };
}

/** Add a closed rectangular room (4 walls). Origin is top-left; width/height in scene units. */
export function addRoom(
  scene: Scene,
  args: { x: number; y: number; width: number; height: number; type?: string; layerId?: string }
): { scene: Scene; lineIds: string[] } {
  let s = scene;
  const { x, y, width, height } = args;
  const corners: [number, number][] = [
    [x, y], [x + width, y], [x + width, y + height], [x, y + height],
  ];
  const lineIds: string[] = [];
  for (let i = 0; i < 4; i++) {
    const [x1, y1] = corners[i];
    const [x2, y2] = corners[(i + 1) % 4];
    const res = addWall(s, { x1, y1, x2, y2, type: args.type, layerId: args.layerId });
    s = res.scene;
    lineIds.push(res.lineId);
  }
  return { scene: s, lineIds };
}

// Default dimensions per hole type (cm), mirroring the catalog element defaults.
// Holes MUST carry these — react-planner's hole renderers read
// element.properties.get('width').get('length') directly and crash on missing
// values. Writing valid defaults here keeps the canonical scene renderable even
// for clients that don't run catalog normalization.
const HOLE_DEFAULTS: Record<string, { width: number; height: number; altitude: number; thickness: number }> = {
  'door': { width: 80, height: 215, altitude: 0, thickness: 30 },
  'double door': { width: 160, height: 215, altitude: 0, thickness: 30 },
  'sliding door': { width: 200, height: 215, altitude: 0, thickness: 30 },
  'panic door': { width: 80, height: 215, altitude: 0, thickness: 30 },
  'double panic door': { width: 160, height: 215, altitude: 0, thickness: 30 },
  'gate': { width: 80, height: 215, altitude: 0, thickness: 30 },
  'window': { width: 90, height: 100, altitude: 90, thickness: 10 },
  'sash window': { width: 90, height: 100, altitude: 90, thickness: 10 },
  'window-curtain': { width: 90, height: 100, altitude: 90, thickness: 10 },
  'venetian-blind-window': { width: 90, height: 100, altitude: 90, thickness: 10 },
};

function holeProperties(type: string, overrides?: Record<string, unknown>): Record<string, unknown> {
  const d = HOLE_DEFAULTS[type] || HOLE_DEFAULTS['door'];
  return {
    width: { length: d.width },
    height: { length: d.height },
    altitude: { length: d.altitude },
    thickness: { length: d.thickness },
    flip_orizzontal: false,
    ...(overrides || {}),
  };
}

/** Add a door/window hole on an existing wall. offset is 0..1 along the line. */
export function addHole(
  scene: Scene,
  args: { lineId: string; type: string; offset?: number; layerId?: string; properties?: Record<string, unknown> }
): { scene: Scene; holeId: string } {
  const next = clone(scene);
  const layer = getLayer(next, args.layerId);
  const line = layer.lines[args.lineId];
  if (!line) throw new Error(`Line "${args.lineId}" not found on layer`);
  const holeId = uid('h');
  layer.holes[holeId] = {
    id: holeId, type: args.type, line: args.lineId,
    offset: args.offset ?? 0.5, properties: holeProperties(args.type, args.properties), selected: false,
  };
  line.holes.push(holeId);
  return { scene: next, holeId };
}

/** Place a catalog item (furniture, fixture) at a point. */
export function addItem(
  scene: Scene,
  args: { type: string; x: number; y: number; rotation?: number; layerId?: string; properties?: Record<string, unknown> }
): { scene: Scene; itemId: string } {
  const next = clone(scene);
  const layer = getLayer(next, args.layerId);
  const itemId = uid('i');
  layer.items[itemId] = {
    id: itemId, type: args.type, x: args.x, y: args.y,
    rotation: args.rotation ?? 0, properties: args.properties || {}, selected: false,
  };
  return { scene: next, itemId };
}

/** Remove any element (vertex/line/hole/item) by id, cleaning up references. */
export function removeElement(scene: Scene, args: { id: string; layerId?: string }): Scene {
  const next = clone(scene);
  const layer = getLayer(next, args.layerId);
  const { id } = args;
  if (layer.lines[id]) {
    for (const holeId of layer.lines[id].holes) delete layer.holes[holeId];
    for (const v of Object.values(layer.vertices)) v.lines = v.lines.filter((l) => l !== id);
    delete layer.lines[id];
  } else if (layer.items[id]) {
    delete layer.items[id];
  } else if (layer.holes[id]) {
    const line = layer.lines[layer.holes[id].line];
    if (line) line.holes = line.holes.filter((h) => h !== id);
    delete layer.holes[id];
  } else if (layer.vertices[id]) {
    for (const lineId of [...layer.vertices[id].lines]) {
      if (layer.lines[lineId]) delete layer.lines[lineId];
    }
    delete layer.vertices[id];
  }
  return next;
}

/** Compact textual summary of a scene for the model to reason over without huge JSON. */
export function summarize(scene: Scene): string {
  const lines: string[] = [`unit=${scene.unit} canvas=${scene.width}x${scene.height}`];
  for (const layer of Object.values(scene.layers)) {
    const walls = Object.values(layer.lines);
    const holes = Object.values(layer.holes);
    const items = Object.values(layer.items);
    lines.push(`layer "${layer.name}" (${layer.id}): ${walls.length} walls, ${holes.length} holes, ${items.length} items`);
    for (const w of walls) {
      const a = layer.vertices[w.vertices[0]];
      const b = layer.vertices[w.vertices[1]];
      lines.push(`  wall ${w.id}: (${a?.x},${a?.y})->(${b?.x},${b?.y})${w.holes.length ? ` holes=[${w.holes.join(',')}]` : ''}`);
    }
    for (const h of holes) lines.push(`  hole ${h.id}: ${h.type} on ${h.line} @${h.offset}`);
    for (const it of items) lines.push(`  item ${it.id}: ${it.type} at (${it.x},${it.y}) rot=${it.rotation}`);
  }
  return lines.join('\n');
}
