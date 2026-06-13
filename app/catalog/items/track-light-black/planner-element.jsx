import React from 'react';
import { Group, BoxGeometry, CylinderGeometry, Mesh, MeshBasicMaterial } from 'three';
import { ReactPlannerSharedStyle } from 'react-planner';

const BLACK = '#141414';

// Black recessed track lighting — a ceiling-mounted track with adjustable heads.
export default {
  name: 'track-light-black',
  prototype: 'items',

  info: {
    title: 'Track Lighting (Black)',
    tag: ['lighting', 'mood', 'ceiling', 'remodel'],
    description: 'Black recessed track lighting with heads',
    image: require('../cube/cube.png'),
  },

  properties: {
    length: { label: 'Track Length', type: 'length-measure', defaultValue: { length: 120, unit: 'cm' } },
    heads: { label: 'Heads', type: 'number', defaultValue: 4 },
    altitude: { label: 'Ceiling Height', type: 'length-measure', defaultValue: { length: 270, unit: 'cm' } },
  },

  render2D: function (element, layer, scene) {
    const len = element.properties.getIn(['length', 'length']);
    const heads = Math.max(1, parseInt(element.properties.get('heads'), 10) || 4);
    const stroke = element.selected ? ReactPlannerSharedStyle.MESH_SELECTED : BLACK;
    const dots = [];
    for (let i = 0; i < heads; i++) {
      const x = ((i + 0.5) / heads) * len;
      dots.push(<circle key={i} cx={x} cy={0} r={5} style={{ fill: BLACK, stroke, strokeWidth: 1 }} />);
    }
    return (
      <g transform={`translate(${-len / 2}, 0)`}>
        <line x1="0" y1="0" x2={len} y2="0" style={{ stroke: BLACK, strokeWidth: 6 }} />
        <line x1="0" y1="0" x2={len} y2="0" style={{ stroke, strokeWidth: 2, opacity: 0.6 }} />
        {dots}
      </g>
    );
  },

  render3D: function (element, layer, scene) {
    const len = element.properties.getIn(['length', 'length']);
    const heads = Math.max(1, parseInt(element.properties.get('heads'), 10) || 4);
    const alt = element.properties.getIn(['altitude', 'length']);

    const group = new Group();
    const black = new MeshBasicMaterial({ color: BLACK });
    const rail = new Mesh(new BoxGeometry(len, 4, 4), black);
    group.add(rail);
    for (let i = 0; i < heads; i++) {
      const head = new Mesh(new CylinderGeometry(3, 4, 8, 12), black);
      head.position.set(-len / 2 + ((i + 0.5) / heads) * len, -6, 0);
      group.add(head);
      const bulb = new Mesh(new CylinderGeometry(2.5, 2.5, 1, 12), new MeshBasicMaterial({ color: '#fff3d6' }));
      bulb.position.set(head.position.x, -10, 0);
      group.add(bulb);
    }
    group.position.y = alt;
    return Promise.resolve(group);
  },
};
