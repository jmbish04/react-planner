import React from 'react';
import { Group, BoxGeometry, Mesh, MeshBasicMaterial, EdgesGeometry, LineSegments, LineBasicMaterial, BoxHelper } from 'three';
import { ReactPlannerSharedStyle } from 'react-planner';

const CARCASS = '#e7e3dc';
const EDGE = 0x9a958c;

// Floor-to-ceiling stacked closet boxes — two compartments stacked vertically to
// double the hanging/closet space. Height defaults to a 240cm ceiling.
export default {
  name: 'closet-stacked',
  prototype: 'items',

  info: {
    title: 'Stacked Closet (Double)',
    tag: ['closet', 'storage', 'remodel'],
    description: 'Floor-to-ceiling stacked closet boxes (doubled space)',
    image: require('../cube/cube.png'),
  },

  properties: {
    color: { label: 'Finish', type: 'color', defaultValue: CARCASS },
    width: { label: 'Width', type: 'length-measure', defaultValue: { length: 100, unit: 'cm' } },
    depth: { label: 'Depth', type: 'length-measure', defaultValue: { length: 60, unit: 'cm' } },
    height: { label: 'Height', type: 'length-measure', defaultValue: { length: 240, unit: 'cm' } },
  },

  render2D: function (element, layer, scene) {
    const w = element.properties.getIn(['width', 'length']);
    const d = element.properties.getIn(['depth', 'length']);
    const color = element.properties.get('color');
    const stroke = element.selected ? ReactPlannerSharedStyle.MESH_SELECTED : '#7a766d';
    return (
      <g transform={`translate(${-w / 2}, ${-d / 2})`}>
        <rect x="0" y="0" width={w} height={d} style={{ fill: color, stroke, strokeWidth: 2 }} />
        <line x1="2" y1={d / 2} x2={w - 2} y2={d / 2} style={{ stroke: '#7a766d', strokeWidth: 1, strokeDasharray: '4 3' }} />
        <line x1={w / 2} y1="2" x2={w / 2} y2={d - 2} style={{ stroke: '#7a766d', strokeWidth: 1, opacity: 0.5 }} />
      </g>
    );
  },

  render3D: function (element, layer, scene) {
    const w = element.properties.getIn(['width', 'length']);
    const d = element.properties.getIn(['depth', 'length']);
    const h = element.properties.getIn(['height', 'length']);
    const color = element.properties.get('color');

    const group = new Group();
    const mat = new MeshBasicMaterial({ color });
    const carcass = new Mesh(new BoxGeometry(w, h, d), mat);
    group.add(carcass);
    group.add(new LineSegments(new EdgesGeometry(new BoxGeometry(w, h, d)), new LineBasicMaterial({ color: EDGE })));

    // mid-height shelf dividing the two stacked compartments
    const shelf = new Mesh(new BoxGeometry(w, 3, d), new MeshBasicMaterial({ color: EDGE }));
    group.add(shelf);
    if (element.selected) group.add(new BoxHelper(carcass, ReactPlannerSharedStyle.MESH_SELECTED));

    group.position.y = h / 2;
    return Promise.resolve(group);
  },
};
