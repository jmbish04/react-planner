import React from 'react';
import { Group, BoxGeometry, Mesh, MeshBasicMaterial, EdgesGeometry, LineSegments, LineBasicMaterial } from 'three';
import { ReactPlannerSharedStyle } from 'react-planner';

const TREAD = '#a98e6a';
const PONY = '#d9d4ca';
const PONY_EDGE = 0x8a8579;

const len = (el, k, d) => {
  const p = el.properties.get(k);
  const v = p && p.get ? p.get('length') : p;
  return typeof v === 'number' ? v : d;
};

/**
 * U-shaped SWITCHBACK staircase for the LOWER level. Two flights with a mid-level
 * landing: climb flight 1 up to the landing, turn, climb flight 2 to the floor
 * above. The footprint is OPEN (you can look down from above) and ringed by a
 * half-height pony wall. Place the matching "stair-opening" item on the upper
 * layer directly above this one.
 *
 * Local plan (before the centering transform): width X = 2*flightWidth + wellGap,
 * depth Y = flightRun + landingDepth. Flight 1 = left, flight 2 = right, landing
 * spans the full width at the BACK (small Y).
 */
export default {
  name: 'switchback-stair',
  prototype: 'items',

  info: {
    title: 'Switchback Stair',
    tag: ['stairs', 'circulation', 'remodel'],
    description: 'U-shaped switchback staircase with mid landing + open well + pony walls',
    image: require('../cube/cube.png'),
  },

  properties: {
    flightWidth: { label: 'Flight Width', type: 'length-measure', defaultValue: { length: 110, unit: 'cm' } },
    flightRun: { label: 'Flight Run', type: 'length-measure', defaultValue: { length: 274, unit: 'cm' } },
    landingDepth: { label: 'Landing Depth', type: 'length-measure', defaultValue: { length: 110, unit: 'cm' } },
    wellGap: { label: 'Well Gap', type: 'length-measure', defaultValue: { length: 24, unit: 'cm' } },
    floorHeight: { label: 'Floor Height', type: 'length-measure', defaultValue: { length: 290, unit: 'cm' } },
    ponyWallHeight: { label: 'Pony Wall Height', type: 'length-measure', defaultValue: { length: 110, unit: 'cm' } },
  },

  render2D: function (element, layer, scene) {
    const fw = len(element, 'flightWidth', 110);
    const run = len(element, 'flightRun', 274);
    const land = len(element, 'landingDepth', 110);
    const gap = len(element, 'wellGap', 24);
    const W = 2 * fw + gap;
    const D = run + land;
    const stroke = element.selected ? ReactPlannerSharedStyle.MESH_SELECTED : '#3a3a3a';
    const treadStroke = element.selected ? ReactPlannerSharedStyle.MESH_SELECTED : '#6b6b6b';

    const nPer = Math.max(3, Math.round(run / 28)); // ~28cm tread going
    const treads = [];
    for (let i = 1; i < nPer; i++) {
      const y = land + (run * i) / nPer;
      // flight 1 (left)
      treads.push(<line key={`a${i}`} x1={0} y1={y} x2={fw} y2={y} style={{ stroke: treadStroke, strokeWidth: 1.5 }} />);
      // flight 2 (right)
      treads.push(<line key={`b${i}`} x1={fw + gap} y1={y} x2={W} y2={y} style={{ stroke: treadStroke, strokeWidth: 1.5 }} />);
    }
    // UP arrow up the left flight (toward the landing at small Y)
    const ax = fw / 2;
    return (
      <g transform={`translate(${-W / 2}, ${-D / 2})`}>
        {/* pony-wall ring (half-height) drawn as a thick open outline */}
        <rect x={0} y={0} width={W} height={D} style={{ fill: 'rgba(217,212,202,0.35)', stroke, strokeWidth: 7 }} />
        <rect x={5} y={5} width={W - 10} height={D - 10} style={{ fill: 'none', stroke, strokeWidth: 1 }} />
        {/* landing */}
        <rect x={0} y={0} width={W} height={land} style={{ fill: 'rgba(150,150,150,0.18)', stroke: treadStroke, strokeWidth: 1 }} />
        {/* well gap between flights */}
        <rect x={fw} y={land} width={gap} height={run} style={{ fill: 'rgba(120,120,120,0.10)', stroke: 'none' }} />
        {treads}
        {/* UP arrow */}
        <line x1={ax} y1={D - 12} x2={ax} y2={land + 14} style={{ stroke: '#2b59ff', strokeWidth: 2 }} />
        <line x1={ax} y1={land + 14} x2={ax - 7} y2={land + 26} style={{ stroke: '#2b59ff', strokeWidth: 2 }} />
        <line x1={ax} y1={land + 14} x2={ax + 7} y2={land + 26} style={{ stroke: '#2b59ff', strokeWidth: 2 }} />
        <text x={ax + 10} y={D - 16} style={{ fontSize: '18px', fill: '#2b59ff' }} transform={`translate(${ax + 10}, ${D - 16}) scale(1,-1) translate(${-(ax + 10)}, ${-(D - 16)})`}>UP</text>
      </g>
    );
  },

  render3D: function (element, layer, scene) {
    const fw = len(element, 'flightWidth', 110);
    const run = len(element, 'flightRun', 274);
    const land = len(element, 'landingDepth', 110);
    const gap = len(element, 'wellGap', 24);
    const fh = len(element, 'floorHeight', 290);
    const pony = len(element, 'ponyWallHeight', 110);
    const W = 2 * fw + gap;
    const D = run + land;

    const group = new Group();
    const wood = new MeshBasicMaterial({ color: TREAD });
    const half = fh / 2;
    const nPer = Math.max(3, Math.round(fh / 2 / 17)); // ~17cm riser per flight

    const buildFlight = (xCenter, zStart, zEnd, yStart, yEnd) => {
      const dz = (zEnd - zStart) / nPer;
      const dy = (yEnd - yStart) / nPer;
      for (let i = 0; i < nPer; i++) {
        const tread = new Mesh(new BoxGeometry(fw, 5, Math.abs(dz) + 1), wood);
        tread.position.set(xCenter, yStart + (i + 1) * dy, zStart + (i + 0.5) * dz);
        group.add(tread);
      }
    };

    // local: x in [-W/2,W/2], z in [-D/2,D/2]. Landing at the back (small z).
    const zFront = D / 2, zLandBack = -D / 2, zLandFront = -D / 2 + land;
    const xLeft = -W / 2 + fw / 2, xRight = W / 2 - fw / 2;
    // flight 1: left, from floor (front) up to landing height (back)
    buildFlight(xLeft, zFront, zLandFront, 0, half);
    // landing platform
    const landing = new Mesh(new BoxGeometry(W, 5, land), wood);
    landing.position.set(0, half, (zLandBack + zLandFront) / 2);
    group.add(landing);
    // flight 2: right, from landing height (back) up to full floor (front)
    buildFlight(xRight, zLandFront, zFront, half, fh);

    // pony walls: 4 thin tall slabs around the perimeter, half-height
    const ponyMat = new MeshBasicMaterial({ color: PONY });
    const t = 8;
    const slab = (w, d, x, z) => {
      const m = new Mesh(new BoxGeometry(w, pony, d), ponyMat);
      m.position.set(x, pony / 2, z);
      group.add(m);
      m.add(new LineSegments(new EdgesGeometry(new BoxGeometry(w, pony, d)), new LineBasicMaterial({ color: PONY_EDGE })));
    };
    slab(W, t, 0, -D / 2);     // back
    slab(W, t, 0, D / 2);      // front
    slab(t, D, -W / 2, 0);     // left
    slab(t, D, W / 2, 0);      // right

    return Promise.resolve(group);
  },
};
