import React from 'react';
import { Group, BoxGeometry, Mesh, MeshBasicMaterial } from 'three';
import { ReactPlannerSharedStyle } from 'react-planner';

const TREAD = '#9b8467';

const len = (el, k, d) => {
  const p = el.properties.get(k);
  const v = p && p.get ? p.get('length') : p;
  return typeof v === 'number' ? v : d;
};

/**
 * A single STRAIGHT run of stairs as drawn in a floor plan — a row of treads with
 * a direction arrow (UP or DN) and a break line. Each floor of a switchback shows
 * one of these (UP on the lower floor, DN on the upper floor, stacked over the
 * same well). The run travels along the local +Y axis; treads are drawn across X.
 */
export default {
  name: 'straight-stair',
  prototype: 'items',

  info: {
    title: 'Stair Run',
    tag: ['stairs', 'circulation'],
    description: 'Single straight stair run with UP/DN arrow',
    image: require('../cube/cube.png'),
  },

  properties: {
    width: { label: 'Width', type: 'length-measure', defaultValue: { length: 107, unit: 'cm' } },
    run: { label: 'Run Length', type: 'length-measure', defaultValue: { length: 300, unit: 'cm' } },
    direction: {
      label: 'Direction', type: 'enum',
      defaultValue: 'up',
      values: { up: 'Up', down: 'Down' },
    },
    floorHeight: { label: 'Floor Height', type: 'length-measure', defaultValue: { length: 145, unit: 'cm' } },
  },

  render2D: function (element, layer, scene) {
    const w = len(element, 'width', 107);
    const run = len(element, 'run', 300);
    const dir = element.properties.get('direction') || 'up';
    const stroke = element.selected ? ReactPlannerSharedStyle.MESH_SELECTED : '#2a2a2a';
    const treadStroke = element.selected ? ReactPlannerSharedStyle.MESH_SELECTED : '#555';
    const n = Math.max(4, Math.round(run / 28));
    const treads = [];
    for (let i = 1; i < n; i++) {
      const y = (run * i) / n;
      treads.push(<line key={i} x1={0} y1={y} x2={w} y2={y} style={{ stroke: treadStroke, strokeWidth: 1.3 }} />);
    }
    const ax = w / 2;
    const up = dir !== 'down';
    // arrow runs along the centre; head toward the top (up) or bottom (down)
    const yTail = up ? 12 : run - 12;
    const yHead = up ? run - 14 : 14;
    const hy = up ? -1 : 1;
    const label = up ? 'UP' : 'DN';
    const ly = up ? 16 : run - 8;
    return (
      <g transform={`translate(${-w / 2}, ${-run / 2})`}>
        <rect x={0} y={0} width={w} height={run} style={{ fill: 'rgba(255,255,255,0.0)', stroke, strokeWidth: 2 }} />
        {treads}
        <line x1={ax} y1={yTail} x2={ax} y2={yHead} style={{ stroke: '#2b59ff', strokeWidth: 2 }} />
        <line x1={ax} y1={yHead} x2={ax - 7} y2={yHead + 12 * hy} style={{ stroke: '#2b59ff', strokeWidth: 2 }} />
        <line x1={ax} y1={yHead} x2={ax + 7} y2={yHead + 12 * hy} style={{ stroke: '#2b59ff', strokeWidth: 2 }} />
        <text x={ax + 11} y={ly} style={{ fontSize: '16px', fill: '#2b59ff' }} transform={`translate(${ax + 11}, ${ly}) scale(1,-1) translate(${-(ax + 11)}, ${-ly})`}>{label}</text>
      </g>
    );
  },

  render3D: function (element, layer, scene) {
    const w = len(element, 'width', 107);
    const run = len(element, 'run', 300);
    const fh = len(element, 'floorHeight', 145);
    const group = new Group();
    const wood = new MeshBasicMaterial({ color: TREAD });
    const n = Math.max(4, Math.round(fh / 17));
    const dz = run / n, dy = fh / n;
    for (let i = 0; i < n; i++) {
      const t = new Mesh(new BoxGeometry(w, 5, dz + 1), wood);
      t.position.set(0, (i + 1) * dy, -run / 2 + (i + 0.5) * dz);
      group.add(t);
    }
    return Promise.resolve(group);
  },
};
