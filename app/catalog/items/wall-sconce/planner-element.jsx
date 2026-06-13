import React from 'react';
import { Group, BoxGeometry, SphereGeometry, Mesh, MeshBasicMaterial } from 'three';
import { ReactPlannerSharedStyle } from 'react-planner';

const BODY = '#1b1b1b';
const GLOW = '#ffd9a0';

// Decorative wall sconce — mounts on a wall at ~180cm, casts warm mood light.
export default {
  name: 'wall-sconce',
  prototype: 'items',

  info: {
    title: 'Wall Sconce',
    tag: ['lighting', 'mood', 'wall', 'decorative', 'remodel'],
    description: 'Decorative wall sconce (warm accent light)',
    image: require('../cube/cube.png'),
  },

  properties: {
    width: { label: 'Width', type: 'length-measure', defaultValue: { length: 14, unit: 'cm' } },
    altitude: { label: 'Mount Height', type: 'length-measure', defaultValue: { length: 180, unit: 'cm' } },
    glow: { label: 'Light Color', type: 'color', defaultValue: GLOW },
  },

  render2D: function (element, layer, scene) {
    const w = element.properties.getIn(['width', 'length']);
    const stroke = element.selected ? ReactPlannerSharedStyle.MESH_SELECTED : BODY;
    return (
      <g transform={`translate(${-w / 2}, ${-w / 2})`}>
        <rect x="0" y="0" width={w} height={w / 2} style={{ fill: BODY, stroke, strokeWidth: 1 }} />
        <circle cx={w / 2} cy={w / 2} r={w / 3} style={{ fill: element.properties.get('glow'), opacity: 0.85 }} />
      </g>
    );
  },

  render3D: function (element, layer, scene) {
    const w = element.properties.getIn(['width', 'length']);
    const alt = element.properties.getIn(['altitude', 'length']);
    const glow = element.properties.get('glow');

    const group = new Group();
    const back = new Mesh(new BoxGeometry(w, w * 1.4, 4), new MeshBasicMaterial({ color: BODY }));
    group.add(back);
    const light = new Mesh(new SphereGeometry(w / 2.4, 12, 12), new MeshBasicMaterial({ color: glow }));
    light.position.set(0, -w * 0.4, w / 2);
    group.add(light);
    group.position.y = alt;
    return Promise.resolve(group);
  },
};
