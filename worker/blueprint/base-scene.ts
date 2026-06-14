// Deterministic generator for the "Core Base" default project — a to-scale
// reproduction of the user's San Francisco row house, traced from the actual
// architectural drawings (proofs/tight/{lower_level_floor_plan,upper_level_floorplan}.jpg),
// NOT from the idealized survey bboxes (which mislabel rooms and don't tile).
//
// Coordinate frame: FEET, origin front-left of the building, +x right, +y toward
// the REAR. react-planner's 2D viewer shows larger Y at the TOP, so rear=high Y
// renders at the top — matching the drawings (patio/bedrooms top, garage/entry bottom).
//   X_cm = round(x_ft * 30.48)   Y_cm = round(y_ft * 30.48)   (no flip)

import type { Scene, Layer, Vertex, Line, Hole, Item } from './scene';
import { holeProperties } from './scene';

const FT2CM = 30.48;
const FLOOR_HEIGHT_CM = 290;

type Side = 'N' | 'S' | 'E' | 'W'; // N=rear(high y), S=front(low y), E=right(high x), W=left(low x)

type RoomDef = {
  id: string; name: string; level: 'lower' | 'upper';
  fx1: number; fy1: number; fx2: number; fy2: number; // feet bbox (fy2 = rear/high)
  fill?: string;
  isCloset?: boolean;
};

// ── Rooms, traced from the drawings (feet). fy increases toward the rear (top). ──
const ROOMS: RoomDef[] = [
  // ===== LOWER LEVEL =====
  { id: 'lower_entryway', name: 'Entryway', level: 'lower', fx1: 0, fy1: 0, fx2: 5.67, fy2: 11.42, fill: '#EFEAE0' },
  { id: 'lower_main_entry', name: 'Main Entry', level: 'lower', fx1: 0, fy1: 11.42, fx2: 6.83, fy2: 16.5, fill: '#EFEAE0' },
  { id: 'lower_garage', name: 'Garage', level: 'lower', fx1: 6.83, fy1: 0, fx2: 25, fy2: 21.75, fill: '#E2E2E2' },
  { id: 'lower_mech', name: 'Mech', level: 'lower', fx1: 11.5, fy1: 16.5, fx2: 17, fy2: 19.5, fill: '#E6E6E6' },
  { id: 'lower_laundry', name: 'Laundry', level: 'lower', fx1: 8.0, fy1: 21.0, fx2: 11.75, fy2: 26.0, fill: '#E6EEF2' },
  { id: 'lower_storage', name: 'Storage', level: 'lower', fx1: 16.5, fy1: 24.0, fx2: 22.0, fy2: 27.0, fill: '#E9E6DF' },
  { id: 'lower_bath', name: 'Bath', level: 'lower', fx1: 16.5, fy1: 27.0, fx2: 25, fy2: 33.0, fill: '#E6EEF2' },
  { id: 'lower_bedroom_cl', name: 'CL', level: 'lower', fx1: 13.0, fy1: 33.0, fx2: 25, fy2: 35.0, fill: '#EDEBE4', isCloset: true },
  { id: 'lower_bedroom', name: 'Bedroom', level: 'lower', fx1: 13.0, fy1: 35.0, fx2: 25, fy2: 48.33, fill: '#F3EEE4' },
  { id: 'lower_family', name: 'Family Room', level: 'lower', fx1: 0, fy1: 25.83, fx2: 11.75, fy2: 48.33, fill: '#F3EEE4' },
  { id: 'lower_patio', name: 'Patio', level: 'lower', fx1: 0.75, fy1: 48.33, fx2: 24.25, fy2: 58.0, fill: '#E7E6DD' },

  // ===== UPPER LEVEL =====
  { id: 'upper_breakfast', name: 'Breakfast Nook', level: 'upper', fx1: 0, fy1: 0, fx2: 8.75, fy2: 5.42, fill: '#F1EDE3' },
  { id: 'upper_kitchen', name: 'Kitchen', level: 'upper', fx1: 0, fy1: 5.42, fx2: 8.75, fy2: 18.25, fill: '#F1EDE3' },
  { id: 'upper_living', name: 'Living Room', level: 'upper', fx1: 8.75, fy1: 0, fx2: 25, fy2: 14.0, fill: '#F3EEE4' },
  { id: 'upper_dining', name: 'Dining Room', level: 'upper', fx1: 8.75, fy1: 14.0, fx2: 25, fy2: 24.83, fill: '#F3EEE4' },
  { id: 'upper_jason', name: "Jason's Office", level: 'upper', fx1: 0, fy1: 18.25, fx2: 11.83, fy2: 28.83, fill: '#EFEEE9' },
  { id: 'upper_hallway', name: 'Hallway', level: 'upper', fx1: 11.83, fy1: 16.5, fx2: 16.0, fy2: 44.42, fill: '#F1EEE8' },
  { id: 'upper_primary_bath', name: 'Primary Bath', level: 'upper', fx1: 16.0, fy1: 33.17, fx2: 24.33, fy2: 44.42, fill: '#E6EEF2' },
  { id: 'upper_primary_bath_cl', name: 'CL', level: 'upper', fx1: 21.5, fy1: 28.0, fx2: 24.33, fy2: 33.17, fill: '#EDEBE4', isCloset: true },
  { id: 'upper_lightwell', name: 'Lightwell', level: 'upper', fx1: 0, fy1: 29.25, fx2: 4.08, fy2: 39.25, fill: '#E9F1F7' },
  { id: 'upper_hall_cl', name: 'CL', level: 'upper', fx1: 8.0, fy1: 33.0, fx2: 9.83, fy2: 39.25, fill: '#EDEBE4', isCloset: true },
  { id: 'upper_hall_bath', name: 'Hall Bath', level: 'upper', fx1: 0, fy1: 39.25, fx2: 8.33, fy2: 44.17, fill: '#E6EEF2' },
  { id: 'upper_jason_cl', name: 'CL', level: 'upper', fx1: 0, fy1: 44.17, fx2: 8.0, fy2: 46.17, fill: '#EDEBE4', isCloset: true },
  { id: 'upper_justin', name: "Justin's Office", level: 'upper', fx1: 0, fy1: 46.17, fx2: 11.92, fy2: 58.0, fill: '#EFEEE9' },
  { id: 'upper_primary', name: 'Primary Bedroom', level: 'upper', fx1: 11.92, fy1: 44.42, fx2: 24.33, fy2: 58.0, fill: '#F3EEE4' },
];

const toX = (fx: number) => Math.round(fx * FT2CM);
const toY = (fy: number) => Math.round(fy * FT2CM);

interface CmRect { id: string; name: string; level: 'lower' | 'upper'; x1: number; x2: number; yTop: number; yBot: number; fill: string; isCloset: boolean }
function toCmRect(r: RoomDef): CmRect {
  return { id: r.id, name: r.name, level: r.level, x1: toX(r.fx1), x2: toX(r.fx2), yTop: toY(r.fy2), yBot: toY(r.fy1), fill: r.fill || '#F1EEE8', isCloset: !!r.isCloset };
}

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
  addWall(x1: number, y1: number, x2: number, y2: number) {
    if (x1 === x2 && y1 === y2) return;
    const a = this.getV(x1, y1), b = this.getV(x2, y2);
    const id = this.id('l');
    this.lines[id] = { id, type: 'wall', vertices: [a, b], holes: [], properties: {}, selected: false };
    this.vertices[a].lines.push(id); this.vertices[b].lines.push(id);
    this.wallList.push({ id, x1, y1, x2, y2 });
  }
  addArea(rect: CmRect) {
    const corners: [number, number][] = [[rect.x1, rect.yTop], [rect.x2, rect.yTop], [rect.x2, rect.yBot], [rect.x1, rect.yBot]];
    const vids = corners.map(([x, y]) => this.getV(x, y));
    const id = `area-${rect.id}`;
    this.areas[id] = {
      id, type: 'area', prototype: 'areas', name: rect.name, selected: false, visible: true, misc: {},
      vertices: vids, holes: [],
      properties: { patternColor: rect.fill, thickness: { length: 0 }, texture: 'none' },
    };
    vids.forEach((v) => this.vertices[v].areas.push(id));
  }
  addItem(type: string, x: number, y: number, rotation: number, properties: Record<string, unknown> = {}) {
    const id = this.id('i');
    this.items[id] = { id, type, x, y, rotation, properties, selected: false };
  }
  private place(orient: 'h' | 'v', coord: number, target: number, type: string): boolean {
    const TOL = 3;
    const cands = this.wallList.filter((w) => orient === 'h' ? (w.y1 === w.y2 && Math.abs(w.y1 - coord) <= TOL) : (w.x1 === w.x2 && Math.abs(w.x1 - coord) <= TOL));
    for (const w of cands) {
      const lo = orient === 'h' ? Math.min(w.x1, w.x2) : Math.min(w.y1, w.y2);
      const hi = orient === 'h' ? Math.max(w.x1, w.x2) : Math.max(w.y1, w.y2);
      if (target < lo + 5 || target > hi - 5) continue;
      const offset = (target - lo) / (hi - lo); // walls always emitted low-endpoint first
      const hid = this.id('h');
      this.holes[hid] = { id: hid, type, line: w.id, offset, properties: holeProperties(type), selected: false };
      this.lines[w.id].holes.push(hid);
      return true;
    }
    return false;
  }
  // Put a door/window on one SIDE of a room, at fraction `frac` along that edge.
  door(rect: CmRect, side: Side, frac: number, type = 'door'): boolean {
    if (side === 'N') return this.place('h', rect.yTop, rect.x1 + frac * (rect.x2 - rect.x1), type);
    if (side === 'S') return this.place('h', rect.yBot, rect.x1 + frac * (rect.x2 - rect.x1), type);
    if (side === 'E') return this.place('v', rect.x2, rect.yBot + frac * (rect.yTop - rect.yBot), type);
    return this.place('v', rect.x1, rect.yBot + frac * (rect.yTop - rect.yBot), type);
  }

  buildWalls(rects: CmRect[]) {
    const vE = new Map<number, [number, number][]>(), hE = new Map<number, [number, number][]>();
    const push = (m: Map<number, [number, number][]>, k: number, a: number, b: number) => { const arr = m.get(k) || []; arr.push([Math.min(a, b), Math.max(a, b)]); m.set(k, arr); };
    for (const r of rects) { push(vE, r.x1, r.yTop, r.yBot); push(vE, r.x2, r.yTop, r.yBot); push(hE, r.yTop, r.x1, r.x2); push(hE, r.yBot, r.x1, r.x2); }
    const union = (iv: [number, number][]): [number, number][] => {
      const s = [...iv].sort((a, b) => a[0] - b[0]); const out: [number, number][] = [];
      for (const [lo, hi] of s) { const last = out[out.length - 1]; if (last && lo <= last[1] + 1) last[1] = Math.max(last[1], hi); else out.push([lo, hi]); }
      return out;
    };
    for (const [x, iv] of vE) for (const [lo, hi] of union(iv)) this.addWall(x, lo, x, hi);
    for (const [y, iv] of hE) for (const [lo, hi] of union(iv)) this.addWall(lo, y, hi, y);
  }
  toLayer(id: string, name: string, altitude: number, order: number): Layer {
    return { id, name, altitude, order, opacity: 1, visible: true, vertices: this.vertices, lines: this.lines, holes: this.holes, areas: this.areas as Record<string, unknown>, items: this.items, selected: { vertices: [], lines: [], holes: [], items: [], areas: [] } };
  }
}

function relativePosition(r: CmRect, lotW: number, lotH: number): string {
  const cx = (r.x1 + r.x2) / 2, cy = (r.yTop + r.yBot) / 2;
  const lr = cx < lotW * 0.38 ? 'left' : cx > lotW * 0.62 ? 'right' : 'center';
  const fb = cy > lotH * 0.62 ? 'back' : cy < lotH * 0.38 ? 'front' : 'mid';
  return `${fb} ${lr}`.replace('mid center', 'center');
}

function roomContext(rects: CmRect[], lotW: number, lotH: number): string {
  const byLevel = (lvl: 'lower' | 'upper') => rects.filter((r) => r.level === lvl && !r.isCloset)
    .map((r) => `  - ${r.name} [${r.id}]: ${relativePosition(r, lotW, lotH)}; bbox ${r.x1},${r.yBot}–${r.x2},${r.yTop} cm (${r.x2 - r.x1}×${r.yTop - r.yBot})`)
    .join('\n');
  return [
    'CORE BASE — the user\'s San Francisco row house, traced from the architectural drawings. Two stacked levels, same ~25ft (762cm) wide footprint.',
    'Orientation: rear/backyard at the TOP (large Y); street/front at the BOTTOM (Y near 0). "back"=top=high Y, "front"=bottom=low Y, "right"=high X, "left"=low X. cm; ~30.48 cm/ft.',
    'Layers: "lower_level" (altitude 0) and "upper_level" (altitude 290), vertically stacked.',
    '',
    'UPPER LEVEL rooms (layer upper_level):',
    byLevel('upper'),
    '',
    'LOWER LEVEL rooms (layer lower_level):',
    byLevel('lower'),
    '',
    'Disambiguation: "back right bedroom" = Primary Bedroom (upper, rear-right). "back left bedroom/office" = Justin\'s Office. The upper level also has Jason\'s Office (a bedroom, mid-left), a Hall Bath, a Primary Bath (en-suite), a Lightwell shaft, the Kitchen + Breakfast Nook (front-left), and the open Dining + Living rooms (Living has the fireplace + front bay window). "CL" rooms are reach-in closets.',
    'STAIRCASE: a switchback. The lower level shows the FIRST flight ("straight-stair" direction up) in the central spine going UP to a mid-landing; the upper level shows the SECOND flight ("straight-stair" direction down, "DN") stacked over the same narrow well, off the Hallway/Dining. The Storage Closet downstairs is the enclosed under-stair vault. The well is narrow (one stair run wide) — it does NOT open over the Family Room.',
    'Structural: central longitudinal load-bearing spine runs front-to-back near the middle; the upper rear cantilevers ~6ft past the lower foundation.',
  ].join('\n');
}

export function baseScene(): Scene {
  const rects = ROOMS.map(toCmRect);
  const lotW = toX(25), lotH = toY(58);
  const byId = (id: string) => rects.find((r) => r.id === id)!;

  const lo = new LevelBuilder('lo');
  lo.buildWalls(rects.filter((r) => r.level === 'lower'));
  for (const r of rects.filter((r) => r.level === 'lower')) lo.addArea(r);
  // Lower openings (windows = sliders/garage/entry; doors per room)
  lo.door(byId('lower_family'), 'N', 0.45, 'sliding door');   // family -> patio slider
  lo.door(byId('lower_bedroom'), 'N', 0.5, 'sliding door');   // bedroom -> patio slider
  lo.door(byId('lower_garage'), 'S', 0.55, 'gate');           // garage door (front)
  lo.door(byId('lower_entryway'), 'S', 0.5, 'door');          // front entry door
  lo.door(byId('lower_entryway'), 'N', 0.5, 'door');          // entry -> main entry
  lo.door(byId('lower_main_entry'), 'E', 0.6, 'door');        // main entry -> garage
  lo.door(byId('lower_family'), 'S', 0.85, 'door');           // family -> central hall
  lo.door(byId('lower_bedroom'), 'S', 0.15, 'door');          // bedroom door
  lo.door(byId('lower_bath'), 'W', 0.5, 'door');              // bath door
  lo.door(byId('lower_laundry'), 'S', 0.5, 'door');           // laundry
  // Lower stair (first flight, UP) in the central spine
  const stairCx = toX(13.9), stairCy = toY(21.5);
  lo.addItem('straight-stair', stairCx, stairCy, 0, {
    width: { length: 114, unit: 'cm' }, run: { length: 305, unit: 'cm' }, direction: 'up', floorHeight: { length: 145, unit: 'cm' },
  });

  const up = new LevelBuilder('up');
  up.buildWalls(rects.filter((r) => r.level === 'upper'));
  for (const r of rects.filter((r) => r.level === 'upper')) up.addArea(r);
  // Upper openings
  up.door(byId('upper_living'), 'S', 0.55, 'window');         // living room front bay window
  up.door(byId('upper_breakfast'), 'S', 0.5, 'window');       // breakfast nook front window
  up.door(byId('upper_kitchen'), 'W', 0.55, 'window');        // kitchen side window (lightwell side)
  up.door(byId('upper_justin'), 'N', 0.5, 'window');          // justin's office rear window
  up.door(byId('upper_primary'), 'N', 0.5, 'window');         // primary bedroom rear window
  up.door(byId('upper_jason'), 'N', 0.5, 'window');           // jason's office (3rd bedroom) window
  // interior doors
  up.door(byId('upper_primary'), 'S', 0.2, 'door');           // hallway -> primary bedroom
  up.door(byId('upper_justin'), 'S', 0.7, 'door');            // hallway -> justin's office
  up.door(byId('upper_jason'), 'E', 0.5, 'door');             // hallway -> jason's office (3rd bedroom)
  up.door(byId('upper_hall_bath'), 'E', 0.6, 'door');         // hallway/landing -> hall bath
  up.door(byId('upper_primary_bath'), 'W', 0.7, 'door');      // primary bath en-suite
  up.door(byId('upper_kitchen'), 'E', 0.4, 'door');           // kitchen -> dining
  up.door(byId('upper_dining'), 'N', 0.2, 'door');            // dining -> hallway
  // Upper stair (second flight, DN) stacked over the lower stair
  up.addItem('straight-stair', stairCx, stairCy, 0, {
    width: { length: 114, unit: 'cm' }, run: { length: 305, unit: 'cm' }, direction: 'down', floorHeight: { length: 145, unit: 'cm' },
  });

  return {
    unit: 'cm', width: lotW + 40, height: lotH + 40,
    meta: { roomContext: roomContext(rects, lotW, lotH), project: 'core-base-sf-rowhouse' },
    guides: { horizontal: {}, vertical: {}, circular: {} },
    selectedLayer: 'lower_level',
    layers: {
      lower_level: lo.toLayer('lower_level', 'Lower Level', 0, 0),
      upper_level: up.toLayer('upper_level', 'Upper Level', FLOOR_HEIGHT_CM, 1),
    },
  };
}
