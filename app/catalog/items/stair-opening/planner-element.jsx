import React from 'react';
import { Group, BoxGeometry, Mesh, MeshBasicMaterial, EdgesGeometry, LineSegments, LineBasicMaterial } from 'three';
import { ReactPlannerSharedStyle } from 'react-planner';

const PONY = '#d9d4ca';
const PONY_EDGE = 0x8a8579;

const len = (el, k, d) => {
  const p = el.properties.get(k);
  const v = p && p.get ? p.get('length') : p;
  return typeof v === 'number' ? v : d;
};

/**
 * The OPEN stair well as seen from the UPPER level: a half-height pony wall
 * ringing the void, with a DN (down) arrow. The interior is empty so the stair
 * below shows through. Place directly above the lower-level "switchback-stair".
 */
export default {
  name: 'stair-opening',
  prototype: 'items',

  info: {
    title: 'Stair Opening',
    tag: ['stairs', 'circulation', 'remodel'],
    description: 'Open stair well with pony-wall railing (upper level)',
    image: require('../cube/cube.png'),
  },

  properties: {
    width: { label: 'Width', type: 'length-measure', defaultValue: { length: 244, unit: 'cm' } },
    depth: { label: 'Depth', type: 'length-measure', defaultValue: { length: 384, unit: 'cm' } },
    ponyWallHeight: { label: 'Pony Wall Height', type: 'length-measure', defaultValue: { length: 110, unit: 'cm' } },
  },

  render2D: function (element, layer, scene) {
    const W = len(element, 'width', 244);
    const D = len(element, 'depth', 384);
    const stroke = element.selected ? ReactPlannerSharedStyle.MESH_SELECTED : '#3a3a3a';
    const ax = W / 2;
    return (
      <g transform={`translate(${-W / 2}, ${-D / 2})`}>
        {/* pony-wall ring; interior empty (open void) */}
        <rect x={0} y={0} width={W} height={D} style={{ fill: 'none', stroke, strokeWidth: 7 }} />
        <rect x={5} y={5} width={W - 10} height={D - 10} style={{ fill: 'none', stroke, strokeWidth: 1 }} />
        {/* DN arrow (pointing toward the front/down the well) */}
        <line x1={ax} y1={16} x2={ax} y2={D - 16} style={{ stroke: '#2b59ff', strokeWidth: 2 }} />
        <line x1={ax} y1={D - 16} x2={ax - 7} y2={D - 28} style={{ stroke: '#2b59ff', strokeWidth: 2 }} />
        <line x1={ax} y1={D - 16} x2={ax + 7} y2={D - 28} style={{ stroke: '#2b59ff', strokeWidth: 2 }} />
        <text x={ax + 10} y={20} style={{ fontSize: '18px', fill: '#2b59ff' }} transform={`translate(${ax + 10}, ${20}) scale(1,-1) translate(${-(ax + 10)}, ${-20})`}>DN</text>
      </g>
    );
  },

  render3D: function (element, layer, scene) {
    const W = len(element, 'width', 244);
    const D = len(element, 'depth', 384);
    const pony = len(element, 'ponyWallHeight', 110);
    const group = new Group();
    const mat = new MeshBasicMaterial({ color: PONY });
    const t = 8;
    const slab = (w, d, x, z) => {
      const m = new Mesh(new BoxGeometry(w, pony, d), mat);
      m.position.set(x, pony / 2, z);
      group.add(m);
      m.add(new LineSegments(new EdgesGeometry(new BoxGeometry(w, pony, d)), new LineBasicMaterial({ color: PONY_EDGE })));
    };
    slab(W, t, 0, -D / 2);
    slab(W, t, 0, D / 2);
    slab(t, D, -W / 2, 0);
    slab(t, D, W / 2, 0);
    return Promise.resolve(group);
  },
};
