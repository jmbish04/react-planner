import React from 'react';
import { BoxGeometry, Mesh, MeshBasicMaterial, BoxHelper, TextureLoader } from 'three';
import { ReactPlannerSharedStyle } from 'react-planner';

const marbleURL = require('./calacatta-viola.jpg');
const texture = new TextureLoader().load(marbleURL);

// Calacatta Viola backsplash — a vertical marble panel that stands against a
// wall, from counter height up by `height` (default 60cm = a halfway backsplash).
// Place flush to a wall and rotate to match the wall direction.
export default {
  name: 'calacatta-viola-backsplash',
  prototype: 'items',

  info: {
    title: 'Calacatta Viola Backsplash',
    tag: ['kitchen', 'marble', 'backsplash', 'remodel'],
    description: 'Calacatta Viola marble half-height backsplash panel',
    image: marbleURL,
  },

  properties: {
    width: { label: 'Width', type: 'length-measure', defaultValue: { length: 244, unit: 'cm' } },
    height: { label: 'Height', type: 'length-measure', defaultValue: { length: 60, unit: 'cm' } },
    thickness: { label: 'Thickness', type: 'length-measure', defaultValue: { length: 3, unit: 'cm' } },
    altitude: { label: 'Altitude (sill)', type: 'length-measure', defaultValue: { length: 90, unit: 'cm' } },
  },

  render2D: function (element, layer, scene) {
    const w = element.properties.getIn(['width', 'length']);
    const t = element.properties.getIn(['thickness', 'length']);
    const patternId = `cviola-bs-${element.id}`;
    const stroke = element.selected ? ReactPlannerSharedStyle.MESH_SELECTED : '#5a4a55';
    const depth = Math.max(t, 6); // give the strip a little visible depth in plan
    return (
      <g transform={`translate(${-w / 2}, ${-depth / 2})`}>
        <defs>
          <pattern id={patternId} patternUnits="userSpaceOnUse" width={w} height={depth}>
            <image href={marbleURL} xlinkHref={marbleURL} x="0" y="0" width={w} height={depth} preserveAspectRatio="xMidYMid slice" />
          </pattern>
        </defs>
        <rect x="0" y="0" width={w} height={depth} style={{ fill: `url(#${patternId})`, stroke, strokeWidth: 2 }} />
      </g>
    );
  },

  render3D: function (element, layer, scene) {
    const w = element.properties.getIn(['width', 'length']);
    const h = element.properties.getIn(['height', 'length']);
    const t = element.properties.getIn(['thickness', 'length']);
    const alt = element.properties.getIn(['altitude', 'length']);

    const geometry = new BoxGeometry(w, h, t);
    const material = new MeshBasicMaterial({ map: texture });
    const mesh = new Mesh(geometry, material);

    if (element.selected) {
      const box = new BoxHelper(mesh, ReactPlannerSharedStyle.MESH_SELECTED);
      box.material.linewidth = 2;
      mesh.add(box);
    }
    mesh.position.y = alt + h / 2;
    return Promise.resolve(mesh);
  },
};
