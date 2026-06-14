// Server-side floorplan renderer: turns a scene (one layer) into a clean
// top-down SVG — walls, named rooms, doors/windows, and stair runs. Used by the
// MCP render_floorplan tool so Claude (and automated tests) can SEE the current
// blueprint without a browser. Coordinates are cm; Y is flipped so the rear
// (high Y) is at the top, matching the canvas.

import type { Scene, Layer, Vertex } from './scene';

const WALL = '#2b2b2b';
const WALL_W = 12;       // cm — drawn wall thickness
const esc = (s: string) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function len(props: any, k: string, d: number): number {
  const p = props && props[k];
  if (p == null) return d;
  if (typeof p === 'number') return p;
  if (typeof p === 'object' && typeof p.length === 'number') return p.length;
  return d;
}

export function renderSceneSvg(scene: Scene, layerId: string): { svg: string; title: string } {
  const layer = scene.layers[layerId];
  if (!layer) throw new Error(`layer ${layerId} not found`);
  const W = scene.width, H = scene.height;
  const PAD = 40;
  // flip Y: cm-Y high -> top
  const tx = (x: number) => Math.round(x + PAD);
  const ty = (y: number) => Math.round((H - y) + PAD);
  const VW = W + 2 * PAD, VH = H + 2 * PAD;

  const parts: string[] = [];
  parts.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${VW} ${VH}" width="${Math.min(900, VW)}" font-family="DejaVu Sans, sans-serif">`);
  parts.push(`<rect x="0" y="0" width="${VW}" height="${VH}" fill="#fbfbf9"/>`);

  // ── Areas (rooms): filled polygon + name ──
  for (const raw of Object.values(layer.areas) as any[]) {
    const vs: Vertex[] = (raw.vertices || []).map((id: string) => layer.vertices[id]).filter(Boolean);
    if (vs.length < 3) continue;
    const pts = vs.map((v) => `${tx(v.x)},${ty(v.y)}`).join(' ');
    const fill = (raw.properties && raw.properties.patternColor) || '#f1eee8';
    parts.push(`<polygon points="${pts}" fill="${fill}" stroke="none"/>`);
  }

  // ── Walls ──
  for (const line of Object.values(layer.lines)) {
    const a = layer.vertices[line.vertices[0]], b = layer.vertices[line.vertices[1]];
    if (!a || !b) continue;
    parts.push(`<line x1="${tx(a.x)}" y1="${ty(a.y)}" x2="${tx(b.x)}" y2="${ty(b.y)}" stroke="${WALL}" stroke-width="${WALL_W}" stroke-linecap="square"/>`);
  }

  // ── Holes (doors / windows): white the gap + symbol ──
  for (const hole of Object.values(layer.holes)) {
    const line = layer.lines[hole.line];
    if (!line) continue;
    const a = layer.vertices[line.vertices[0]], b = layer.vertices[line.vertices[1]];
    if (!a || !b) continue;
    const w = len(hole.properties, 'width', 80);
    const L = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    const ux = (b.x - a.x) / L, uy = (b.y - a.y) / L;     // unit along wall
    const cx = a.x + ux * hole.offset * L, cy = a.y + uy * hole.offset * L;
    const p1x = cx - ux * w / 2, p1y = cy - uy * w / 2;
    const p2x = cx + ux * w / 2, p2y = cy + uy * w / 2;
    // erase the wall under the opening
    parts.push(`<line x1="${tx(p1x)}" y1="${ty(p1y)}" x2="${tx(p2x)}" y2="${ty(p2y)}" stroke="#fbfbf9" stroke-width="${WALL_W + 2}" stroke-linecap="butt"/>`);
    const isWindow = /window/.test(hole.type);
    if (isWindow) {
      parts.push(`<line x1="${tx(p1x)}" y1="${ty(p1y)}" x2="${tx(p2x)}" y2="${ty(p2y)}" stroke="#3a6ea5" stroke-width="4"/>`);
    } else {
      // door: jamb + quarter-arc swing
      const nx = -uy, ny = ux; // wall normal
      const hx = p1x + nx * w, hy = p1y + ny * w;
      parts.push(`<line x1="${tx(p1x)}" y1="${ty(p1y)}" x2="${tx(hx)}" y2="${ty(hy)}" stroke="${WALL}" stroke-width="3"/>`);
      parts.push(`<path d="M ${tx(hx)} ${ty(hy)} A ${w} ${w} 0 0 0 ${tx(p2x)} ${ty(p2y)}" fill="none" stroke="#777" stroke-width="2" stroke-dasharray="6 5"/>`);
    }
  }

  // ── Items (furniture / stairs) ──
  for (const it of Object.values(layer.items)) {
    if (it.type === 'straight-stair') {
      const w = len(it.properties, 'width', 110), run = len(it.properties, 'run', 300);
      const dir = (it.properties as any)?.direction || 'up';
      const x0 = tx(it.x - w / 2), y0 = ty(it.y + run / 2); // top-left in svg
      parts.push(`<rect x="${x0}" y="${y0}" width="${Math.round(w)}" height="${Math.round(run)}" fill="rgba(0,0,0,0.03)" stroke="${WALL}" stroke-width="3"/>`);
      const n = Math.max(4, Math.round(run / 28));
      for (let i = 1; i < n; i++) { const yy = y0 + (run * i) / n; parts.push(`<line x1="${x0}" y1="${Math.round(yy)}" x2="${x0 + Math.round(w)}" y2="${Math.round(yy)}" stroke="#888" stroke-width="1.5"/>`); }
      const cxp = tx(it.x); const up = dir !== 'down';
      const yA = up ? y0 + run - 12 : y0 + 12, yB = up ? y0 + 12 : y0 + run - 12;
      parts.push(`<line x1="${cxp}" y1="${Math.round(yA)}" x2="${cxp}" y2="${Math.round(yB)}" stroke="#2b59ff" stroke-width="3"/>`);
      parts.push(`<text x="${cxp + 8}" y="${Math.round(up ? y0 + run - 16 : y0 + 22)}" font-size="20" fill="#2b59ff">${up ? 'UP' : 'DN'}</text>`);
      continue;
    }
    const w = len(it.properties, 'width', len(it.properties, 'length', 90));
    const d = len(it.properties, 'depth', 60);
    parts.push(`<g transform="translate(${tx(it.x)} ${ty(it.y)}) rotate(${-(it.rotation || 0)})"><rect x="${-w/2}" y="${-d/2}" width="${Math.round(w)}" height="${Math.round(d)}" fill="rgba(80,80,80,0.10)" stroke="#666" stroke-width="2"/></g>`);
    parts.push(`<text x="${tx(it.x)}" y="${ty(it.y)}" font-size="14" fill="#555" text-anchor="middle">${esc(it.type)}</text>`);
  }

  // ── Room name labels (drawn last, on top) ──
  for (const raw of Object.values(layer.areas) as any[]) {
    const vs: Vertex[] = (raw.vertices || []).map((id: string) => layer.vertices[id]).filter(Boolean);
    if (vs.length < 3) continue;
    const cx = vs.reduce((s, v) => s + v.x, 0) / vs.length;
    const cy = vs.reduce((s, v) => s + v.y, 0) / vs.length;
    parts.push(`<text x="${tx(cx)}" y="${ty(cy)}" font-size="20" fill="#333" text-anchor="middle" dominant-baseline="middle">${esc(raw.name || '')}</text>`);
  }

  // title bar
  parts.push(`<text x="${PAD}" y="26" font-size="24" fill="#222" font-weight="bold">${esc(layer.name)} — Core Base</text>`);
  parts.push(`</svg>`);
  return { svg: parts.join('\n'), title: layer.name };
}
