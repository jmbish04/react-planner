import React from 'react';
import { BoxGeometry, Mesh, MeshBasicMaterial, BoxHelper, EdgesGeometry, LineSegments, LineBasicMaterial } from 'three';
import { ReactPlannerSharedStyle } from 'react-planner';

const WALNUT = '#5b4636';

// Walnut base (lower) cabinet — counter-height carcass, no uppers. Top sits at
// ~90cm so a countertop slab lands flush on top.
export default {
  name: 'walnut-base-cabinet',
  prototype: 'items',

  info: {
    title: 'Walnut Base Cabinet',
    tag: ['kitchen', 'cabinet', 'walnut', 'remodel'],
    description: 'Walnut lower cabinet (base unit)',
    image: require('../cube/cube.png'),
  },

  properties: {
    color: { label: 'Finish', type: 'color', defaultValue: WALNUT },
    width: { label: 'Width', type: 'length-measure', defaultValue: { length: 60, unit: 'cm' } },
    depth: { label: 'Depth', type: 'length-measure', defaultValue: { length: 60, unit: 'cm' } },
    height: { label: 'Height', type: 'length-measure', defaultValue: { length: 90, unit: 'cm' } },
  },

  render2D: function (element, layer, scene) {
    const w = element.properties.getIn(['width', 'length']);
    const d = element.properties.getIn(['depth', 'length']);
    const color = element.properties.get('color');
    const stroke = element.selected ? ReactPlannerSharedStyle.MESH_SELECTED : '#2b2018';
    return (
      <g transform={`translate(${-w / 2}, ${-d / 2})`}>
        <rect x="0" y="0" width={w} height={d} style={{ fill: color, stroke, strokeWidth: 2 }} />
        {/* door reveal line */}
        <line x1={w * 0.5} y1="2" x2={w * 0.5} y2={d - 2} style={{ stroke: '#2b2018', strokeWidth: 1, opacity: 0.5 }} />
      </g>
    );
  },

  render3D: function (element, layer, scene) {
    const w = element.properties.getIn(['width', 'length']);
    const d = element.properties.getIn(['depth', 'length']);
    const h = element.properties.getIn(['height', 'length']);
    const color = element.properties.get('color');

    const geometry = new BoxGeometry(w, h, d);
    const material = new MeshBasicMaterial({ color });
    const mesh = new Mesh(geometry, material);

    const edges = new LineSegments(new EdgesGeometry(geometry), new LineBasicMaterial({ color: 0x2b2018 }));
    mesh.add(edges);
    if (element.selected) mesh.add(new BoxHelper(mesh, ReactPlannerSharedStyle.MESH_SELECTED));

    mesh.position.y = h / 2;
    return Promise.resolve(mesh);
  },
};
