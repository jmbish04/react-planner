// Deterministic generator for the "Core Base" default project: a to-scale
// reproduction of the user's San Francisco row house (both levels) from the
// surveyed coordinate JSON. Produces a react-planner scene with one named area
// per room, a clean (de-duplicated) wall network, curated exterior openings,
// a switchback staircase, and a meta.roomContext block the agent uses to resolve
// natural-language room references ("the back right bedroom").
//
// Coordinate transform: source is FEET (origin bottom-left, +y toward the rear).
// react-planner's 2D viewer displays LARGER Y at the TOP of the canvas, so to
// match the source drawing (patio/bedrooms at top, garage/entry at the bottom)
// we map rear -> high Y, with NO flip:
//   X_cm = round(x_ft * 30.48)
//   Y_cm = round(y_ft * 30.48)   // rear (high y) renders at top; street/front (y=0) at bottom

import type { Scene, Layer, Vertex, Line, Hole, Item } from './scene';
import { holeProperties } from './scene';

const FT2CM = 30.48;
const LOT_DEPTH_FT = 58.0;
const FLOOR_HEIGHT_CM = 290; // upper-level floor altitude

type RoomDef = {
  id: string;
  name: string;
  level: 'lower' | 'upper';
  fx1: number; fy1: number; fx2: number; fy2: number; // feet bbox
  fill?: string;   // 2D patternColor
};

// Surveyed rooms (feet), transcribed from floorplan_coordinates.json.
const ROOMS: RoomDef[] = [
  // ── Lower level ───────────────────────────────────────────────────────────
  { id: 'lowerlevel_entryway', name: 'Entryway', level: 'lower', fx1: 0, fy1: 0, fx2: 5.67, fy2: 11.42, fill: '#EFEAE0' },
  { id: 'lowerlevel_main_entry_lobby', name: 'Main Entry Lobby', level: 'lower', fx1: 0, fy1: 11.42, fx2: 6.83, fy2: 16.5, fill: '#EFEAE0' },
  { id: 'lowerlevel_garage', name: 'Garage', level: 'lower', fx1: 6.83, fy1: 0, fx2: 25.0, fy2: 21.75, fill: '#E2E2E2' },
  { id: 'lowerlevel_wet_bar', name: 'Wet Bar', level: 'lower', fx1: 0, fy1: 22.58, fx2: 5.0, fy2: 28.58, fill: '#E6EEF2' },
  { id: 'lowerlevel_laundry', name: 'Laundry Room', level: 'lower', fx1: 5.0, fy1: 22.58, fx2: 10.0, fy2: 28.58, fill: '#E6EEF2' },
  { id: 'lowerlevel_lower_level_hallway', name: 'Lower Level Hallway', level: 'lower', fx1: 10.0, fy1: 16.5, fx2: 25.0, fy2: 29.75, fill: '#F1EEE8' },
  { id: 'lowerlevel_family_room', name: 'Family Room', level: 'lower', fx1: 0, fy1: 28.58, fx2: 12.42, fy2: 52.0, fill: '#F3EEE4' },
  { id: 'lowerlevel_bathroom', name: 'Lower Level Bathroom', level: 'lower', fx1: 10.0, fy1: 29.75, fx2: 15.0, fy2: 37.83, fill: '#E6EEF2' },
  { id: 'lowerlevel_storage', name: 'Storage Closet', level: 'lower', fx1: 15.0, fy1: 29.75, fx2: 18.0, fy2: 37.83, fill: '#E9E6DF' },
  { id: 'lowerlevel_bedroom', name: 'Lower Level Bedroom', level: 'lower', fx1: 12.58, fy1: 37.83, fx2: 25.0, fy2: 52.0, fill: '#F3EEE4' },
  { id: 'lowerlevel_patio', name: 'Rear Patio', level: 'lower', fx1: 0, fy1: 52.0, fx2: 23.5, fy2: 58.0, fill: '#E7E6DD' },
  // ── Upper level ───────────────────────────────────────────────────────────
  { id: 'upperlevel_kitchen', name: 'Kitchen', level: 'upper', fx1: 0, fy1: 0, fx2: 8.75, fy2: 18.25, fill: '#F1EDE3' },
  { id: 'upperlevel_living_room', name: 'Living Room', level: 'upper', fx1: 8.75, fy1: 0, fx2: 23.75, fy2: 24.83, fill: '#F3EEE4' },
  { id: 'upperlevel_jason_office', name: "Jason's Office", level: 'upper', fx1: 0, fy1: 18.25, fx2: 9.17, fy2: 29.25, fill: '#EFEEE9' },
  { id: 'upperlevel_lightwell', name: 'Lightwell', level: 'upper', fx1: 0, fy1: 29.25, fx2: 4.08, fy2: 39.25, fill: '#E9F1F7' },
  { id: 'upperlevel_hall_bath', name: 'Hall Bath', level: 'upper', fx1: 4.08, fy1: 34.25, fx2: 9.08, fy2: 39.25, fill: '#E6EEF2' },
  { id: 'upperlevel_hallway', name: 'Upper Hallway', level: 'upper', fx1: 8.75, fy1: 18.25, fx2: 15.51, fy2: 44.42, fill: '#F1EEE8' },
  { id: 'upperlevel_primary_bath', name: 'Primary Bath', level: 'upper', fx1: 15.51, fy1: 33.17, fx2: 23.84, fy2: 44.42, fill: '#E6EEF2' },
  { id: 'upperlevel_justin_office', name: "Justin's Office", level: 'upper', fx1: 0, fy1: 44.42, fx2: 11.92, fy2: 58.0, fill: '#EFEEE9' },
  { id: 'upperlevel_primary_bedroom', name: 'Primary Bedroom', level: 'upper', fx1: 11.92, fy1: 44.42, fx2: 23.84, fy2: 58.0, fill: '#F3EEE4' },
];

const toX = (fx: number) => Math.round(fx * FT2CM);
const toY = (fy: number) => Math.round(fy * FT2CM); // no flip: rear=high Y renders at top

interface CmRect { id: string; name: string; level: 'lower' | 'upper'; x1: number; x2: number; yTop: number; yBot: number; fill: string }

function toCmRect(r: RoomDef): CmRect {
  return {
    id: r.id, name: r.name, level: r.level,
    x1: toX(r.fx1), x2: toX(r.fx2),
    yTop: toY(r.fy2), // rear edge -> larger Y -> renders at the top of the canvas
    yBot: toY(r.fy1), // front edge -> smaller Y -> bottom
    fill: r.fill || '#F1EEE8',
  };
}

// ── Per-level builder ────────────────────────────────────────────────────────
class LevelBuilder {
  vertices: Record<string, Vertex> = {};
  lines: Record<string, Line> = {};
  holes: Record<string, Hole> = {};
  areas: Record<string, unknown> = {};
  items: Record<string, Item> = {};
  private vmap = new Map<string, string>();
  private wallList: { id: string; x1: number; y1: number; x2: number; y2: number }[] = [];
  private n = 0;

  constructor(private prefix: string) {}
  private id(t: string) { return `${this.prefix}-${t}-${++this.n}`; }

  getV(x: number, y: number): string {
    const key = `${x},${y}`;
    let id = this.vmap.get(key);
    if (id) return id;
    id = this.id('v');
    this.vertices[id] = { id, x, y, lines: [], areas: [] };
    this.vmap.set(key, id);
    return id;
  }

  addWall(x1: number, y1: number, x2: number, y2: number): string {
    if (x1 === x2 && y1 === y2) return '';
    const a = this.getV(x1, y1);
    const b = this.getV(x2, y2);
    const id = this.id('l');
    this.lines[id] = { id, type: 'wall', vertices: [a, b], holes: [], properties: {}, selected: false };
    this.vertices[a].lines.push(id);
    this.vertices[b].lines.push(id);
    this.wallList.push({ id, x1, y1, x2, y2 });
    return id;
  }

  addArea(rect: CmRect, texture = 'none') {
    // Corners around the rectangle (consistent ring; convex quad renders fine either winding).
    const corners: [number, number][] = [
      [rect.x1, rect.yTop], [rect.x2, rect.yTop], [rect.x2, rect.yBot], [rect.x1, rect.yBot],
    ];
    const vids = corners.map(([x, y]) => this.getV(x, y));
    const id = `area-${rect.id}`;
    this.areas[id] = {
      id, type: 'area', prototype: 'areas', name: rect.name,
      selected: false, visible: true, misc: {},
      vertices: vids, holes: [],
      properties: { patternColor: rect.fill, thickness: { length: 0 }, texture },
    };
    vids.forEach((v) => this.vertices[v].areas.push(id));
  }

  // Find a horizontal ('h') or vertical ('v') wall at the given fixed coord whose
  // span contains `target`, and add a hole there. Returns true if placed.
  addHoleAt(orient: 'h' | 'v', coord: number, target: number, type: string, overrides?: Record<string, unknown>): boolean {
    const TOL = 2;
    const cands = this.wallList.filter((w) => {
      if (orient === 'h') return Math.abs(w.y1 - coord) <= TOL && w.y1 === w.y2;
      return Math.abs(w.x1 - coord) <= TOL && w.x1 === w.x2;
    });
    for (const w of cands) {
      const lo = orient === 'h' ? Math.min(w.x1, w.x2) : Math.min(w.y1, w.y2);
      const hi = orient === 'h' ? Math.max(w.x1, w.x2) : Math.max(w.y1, w.y2);
      if (target < lo + 5 || target > hi - 5) continue;
      // offset measured from the line's min vertex (min x for 'h', min y for 'v')
      const minVal = orient === 'h'
        ? (this.vertices[this.lines[w.id].vertices[0]].x <= this.vertices[this.lines[w.id].vertices[1]].x ? lo : hi)
        : (this.vertices[this.lines[w.id].vertices[0]].y <= this.vertices[this.lines[w.id].vertices[1]].y ? lo : hi);
      const offset = Math.abs(target - minVal) / (hi - lo);
      const hid = this.id('h');
      this.holes[hid] = { id: hid, type, line: w.id, offset, properties: holeProperties(type, overrides), selected: false };
      this.lines[w.id].holes.push(hid);
      return true;
    }
    return false;
  }

  addItem(type: string, x: number, y: number, rotation: number, properties: Record<string, unknown> = {}): string {
    const id = this.id('i');
    this.items[id] = { id, type, x, y, rotation, properties, selected: false };
    return id;
  }

  // Build a clean wall network: union all room-edge intervals per axis coordinate
  // so shared walls between adjacent rooms become a single continuous wall.
  buildWalls(rects: CmRect[]) {
    const vEdges = new Map<number, [number, number][]>(); // x -> [yLo,yHi] intervals
    const hEdges = new Map<number, [number, number][]>(); // y -> [xLo,xHi] intervals
    const push = (m: Map<number, [number, number][]>, k: number, a: number, b: number) => {
      const arr = m.get(k) || []; arr.push([Math.min(a, b), Math.max(a, b)]); m.set(k, arr);
    };
    for (const r of rects) {
      push(vEdges, r.x1, r.yTop, r.yBot);
      push(vEdges, r.x2, r.yTop, r.yBot);
      push(hEdges, r.yTop, r.x1, r.x2);
      push(hEdges, r.yBot, r.x1, r.x2);
    }
    const union = (intervals: [number, number][]): [number, number][] => {
      const sorted = [...intervals].sort((a, b) => a[0] - b[0]);
      const out: [number, number][] = [];
      for (const [lo, hi] of sorted) {
        const last = out[out.length - 1];
        if (last && lo <= last[1] + 1) last[1] = Math.max(last[1], hi);
        else out.push([lo, hi]);
      }
      return out;
    };
    for (const [x, ints] of vEdges) for (const [lo, hi] of union(ints)) this.addWall(x, lo, x, hi);
    for (const [y, ints] of hEdges) for (const [lo, hi] of union(ints)) this.addWall(lo, y, hi, y);
  }

  toLayer(id: string, name: string, altitude: number, order: number): Layer {
    return {
      id, name, altitude, order, opacity: 1, visible: true,
      vertices: this.vertices, lines: this.lines, holes: this.holes,
      areas: this.areas as Record<string, unknown>, items: this.items,
      selected: { vertices: [], lines: [], holes: [], items: [], areas: [] },
    };
  }
}

function relativePosition(r: CmRect, lotW: number, lotH: number): string {
  const cx = (r.x1 + r.x2) / 2, cy = (r.yTop + r.yBot) / 2;
  const lr = cx < lotW * 0.38 ? 'left' : cx > lotW * 0.62 ? 'right' : 'center';
  // Y large = rear/back (top of canvas); Y small = front/street (bottom)
  const fb = cy > lotH * 0.62 ? 'back' : cy < lotH * 0.38 ? 'front' : 'mid';
  return `${fb} ${lr}`.replace('mid center', 'center');
}

function roomContext(rects: CmRect[], lotW: number, lotH: number): string {
  const byLevel = (lvl: 'lower' | 'upper') => rects.filter((r) => r.level === lvl)
    .map((r) => `  - ${r.name} [${r.id}]: ${relativePosition(r, lotW, lotH)}; bbox ${r.x1},${r.yTop}–${r.x2},${r.yBot} cm (${Math.round((r.x2 - r.x1))}×${Math.round((r.yBot - r.yTop))})`)
    .join('\n');
  return [
    'CORE BASE — San Francisco row house (this home). Two stacked levels, same footprint; the upper level cantilevers ~183cm past the lower at the rear.',
    'Orientation: the rear/backyard is at the TOP of the canvas (large Y); the street/front is at the BOTTOM (Y near 0). "back" = rear = top = high Y, "front" = street = bottom = low Y. "right" = high X, "left" = low X. Units cm; ~30.48 cm per foot.',
    'Layers: "lower_level" (altitude 0) and "upper_level" (altitude 290). The same X,Y on each layer is vertically stacked.',
    '',
    'UPPER LEVEL rooms (layer upper_level):',
    byLevel('upper'),
    '',
    'LOWER LEVEL rooms (layer lower_level):',
    byLevel('lower'),
    '',
    'Vertical stacking (room directly below ↔ above): Primary Bedroom is above the Lower Level Bedroom; Primary Bath is above the Lower Level Bathroom + Storage Closet (shared plumbing wet core); Hall Bath is above the Laundry + Lower Bathroom; Kitchen is above the Entryway/Lobby/Garage; Living Room is above the Garage; the Offices are above the Family Room/Patio.',
    'Disambiguation: "the back right bedroom" = Primary Bedroom (upper level, rear-right). "the back left office" = Justin\'s Office. The Lower Level Bedroom is the rear-right room downstairs.',
    '',
    'STAIRCASE (central, open well): a U-shaped SWITCHBACK. From the lower hallway you climb the first flight UP to a mid-level landing, then turn LEFT and climb a second flight to the upper hallway. The wall on your RIGHT while ascending is the Primary Bath wall (stacked directly above the Lower Level Bathroom — the plumbing wet core). The entire stair footprint is OPEN: you can look down on both flights from the Dining/Living area and the Upper Hallway. The opening is ringed by a half-height PONY WALL (not a full-height wall). A skylight sits over the landing. Storage Closet is the enclosed under-stair vault. The stair is the "switchback-stair" item on lower_level; the open well is the "stair-opening" item on upper_level directly above it.',
    'Structural notes: a central longitudinal load-bearing spine runs front-to-back near X≈380cm (the right partition of the Family Room / left partition of the Lower Bedroom is a reinforced 3×2x12). The garage left firewall carries holdowns. The upper rear cantilevers 6ft past the lower foundation (do not move rear exterior walls without noting this).',
  ].join('\n');
}

/**
 * Build the Core Base default scene: the user's two-level SF row house, to scale,
 * with named room areas, a clean wall network, exterior openings, the switchback
 * stair + upper stair-opening, and meta.roomContext for the agent.
 */
export function baseScene(): Scene {
  const rects = ROOMS.map(toCmRect);
  const lotW = toX(25.0);            // 762
  const lotH = toY(LOT_DEPTH_FT);    // 1768 (rear, top); front is Y=0 (bottom)
  const canvasW = lotW + 40;
  const canvasH = lotH + 40;

  const lowerRects = rects.filter((r) => r.level === 'lower');
  const upperRects = rects.filter((r) => r.level === 'upper');

  // ── Lower level ──
  const lo = new LevelBuilder('lo');
  lo.buildWalls(lowerRects);
  for (const r of lowerRects) lo.addArea(r);
  // Exterior openings (front = bottom, Y=1768; rear = top)
  lo.addHoleAt('h', toY(0), toX(2.8), 'door');                 // front entry door (entryway)
  lo.addHoleAt('h', toY(0), toX(15.9), 'gate');                // garage door (wide front opening)
  lo.addHoleAt('h', toY(52), toX(6.2), 'sliding door');        // family room -> patio slider
  lo.addHoleAt('h', toY(52), toX(18.8), 'sliding door');       // lower bedroom -> patio slider
  // Interior doors off the hallway
  lo.addHoleAt('v', toX(10), toY(33.7), 'door');               // bathroom
  lo.addHoleAt('h', toY(37.83), toX(18.5), 'door');            // lower bedroom from hallway side
  // Switchback stair sits in the central hall near the wet core; bath wall on the right of ascent.
  const stairCx = toX(16.0), stairCy = toY(24.5);
  lo.addItem('switchback-stair', stairCx, stairCy, 0, {
    flightWidth: { length: 110, unit: 'cm' },
    flightRun: { length: 274, unit: 'cm' },
    landingDepth: { length: 110, unit: 'cm' },
    wellGap: { length: 24, unit: 'cm' },
    floorHeight: { length: FLOOR_HEIGHT_CM, unit: 'cm' },
    ponyWallHeight: { length: 110, unit: 'cm' },
  });

  // ── Upper level ──
  const up = new LevelBuilder('up');
  up.buildWalls(upperRects);
  for (const r of upperRects) up.addArea(r);
  up.addHoleAt('h', toY(0), toX(4.4), 'window');               // kitchen front window
  up.addHoleAt('h', toY(0), toX(16.0), 'window');              // living room front bay window
  up.addHoleAt('h', toY(58), toX(6.0), 'window');              // justin's office rear window
  up.addHoleAt('h', toY(58), toX(17.9), 'window');             // primary bedroom rear window
  up.addHoleAt('v', toX(15.51), toY(40.0), 'door');            // primary bath en-suite door
  // Open stair well directly above the lower stair.
  up.addItem('stair-opening', stairCx, stairCy, 0, {
    width: { length: 244, unit: 'cm' },
    depth: { length: 384, unit: 'cm' },
    ponyWallHeight: { length: 110, unit: 'cm' },
  });

  const scene: Scene = {
    unit: 'cm',
    width: canvasW,
    height: canvasH,
    meta: { roomContext: roomContext(rects, lotW, lotH), project: 'core-base-sf-rowhouse' },
    guides: { horizontal: {}, vertical: {}, circular: {} },
    selectedLayer: 'lower_level',
    layers: {
      lower_level: lo.toLayer('lower_level', 'Lower Level', 0, 0),
      upper_level: up.toLayer('upper_level', 'Upper Level', FLOOR_HEIGHT_CM, 1),
    },
  };
  return scene;
}
