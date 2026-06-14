import {ElementsFactories} from 'react-planner';

let info = {
  title: 'area',
  tag: ['area'],
  description: 'Generic Room',
  image: ''
};

let textures = {
  parquet: {
    name: 'Parquet',
    uri: require('./textures/parquet.jpg'),
    lengthRepeatScale: 0.004,
    heightRepeatScale: 0.004,
  },
  tile1: {
    name: 'Tile1',
    uri: require('./textures/tile1.jpg'),
    lengthRepeatScale: 0.01,
    heightRepeatScale: 0.01,
  },
  ceramic: {
    name:'Ceramic Tile',
    uri: require('./textures/ceramic-tile.jpg'),
    lengthRepeatScale: 0.02,
    heightRepeatScale: 0.02
  },
  strand_porcelain: {
    name:'Strand Porcelain Tile',
    uri: require('./textures/strand-porcelain.jpg'),
    lengthRepeatScale: 0.02,
    heightRepeatScale: 0.02
  },
  grass: {
    name: 'Grass',
    uri: require('./textures/grass.jpg'),
    lengthRepeatScale: 0.01,
    heightRepeatScale: 0.01,
  },
  walnut: {
    name: 'Walnut Wide Plank',
    uri: require('./textures/walnut.jpg'),
    lengthRepeatScale: 0.0028,
    heightRepeatScale: 0.0028,
  },
  oak: {
    name: 'White Oak Wide Plank',
    uri: require('./textures/oak.jpg'),
    lengthRepeatScale: 0.0028,
    heightRepeatScale: 0.0028,
  }
};

export default ElementsFactories.AreaFactory('area', info, textures);
