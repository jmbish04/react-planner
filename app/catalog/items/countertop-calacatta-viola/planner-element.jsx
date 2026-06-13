import React from 'react';
import { BoxGeometry, Mesh, MeshBasicMaterial, BoxHelper, TextureLoader } from 'three';
import { ReactPlannerSharedStyle } from 'react-planner';

const marbleURL = require('./calacatta-viola.jpg');
const texture = new TextureLoader().load(marbleURL);

// Calacatta Viola countertop slab — a thin marble surface placed at counter
// height (altitude). Use for kitchen counters; pair with the matching backsplash.
export default {
  name: 'calacatta-viola-countertop',
  prototype: 'items',

  info: {
    title: 'Calacatta Viola Counter',
    tag: ['kitchen', 'marble', 'countertop', 'remodel'],
    description: 'Calacatta Viola marble countertop slab',
    image: marbleURL,
  },

  properties: {
    width: { label: 'Width', type: 'length-measure', defaultValue: { length: 244, unit: 'cm' } },
    depth: { label: 'Depth', type: 'length-measure', defaultValue: { length: 63, unit: 'cm' } },
    thickness: { label: 'Thickness', type: 'length-measure', defaultValue: { length: 4, unit: 'cm' } },
    altitude: { label: 'Altitude', type: 'length-measure', defaultValue: { length: 90, unit: 'cm' } },
  },

  render2D: function (element, layer, scene) {
    const w = element.properties.getIn(['width', 'length']);
    const d = element.properties.getIn(['depth', 'length']);
    const patternId = `cviola-${element.id}`;
    const stroke = element.selected ? ReactPlannerSharedStyle.MESH_SELECTED : '#5a4a55';
    return (
      <g transform={`translate(${-w / 2}, ${-d / 2})`}>
        <defs>
          <pattern id={patternId} patternUnits="userSpaceOnUse" width={w} height={d}>
            <image href={marbleURL} xlinkHref={marbleURL} x="0" y="0" width={w} height={d} preserveAspectRatio="xMidYMid slice" />
          </pattern>
        </defs>
        <rect x="0" y="0" width={w} height={d} style={{ fill: `url(#${patternId})`, stroke, strokeWidth: 2 }} />
      </g>
    );
  },

  render3D: function (element, layer, scene) {
    const w = element.properties.getIn(['width', 'length']);
    const d = element.properties.getIn(['depth', 'length']);
    const t = element.properties.getIn(['thickness', 'length']);
    const alt = element.properties.getIn(['altitude', 'length']);

    const geometry = new BoxGeometry(w, t, d);
    const material = new MeshBasicMaterial({ map: texture });
    const mesh = new Mesh(geometry, material);

    if (element.selected) {
      const box = new BoxHelper(mesh, ReactPlannerSharedStyle.MESH_SELECTED);
      box.material.linewidth = 2;
      box.renderOrder = 1000;
      mesh.add(box);
    }
    mesh.position.y = alt + t / 2;
    return Promise.resolve(mesh);
  },
};
