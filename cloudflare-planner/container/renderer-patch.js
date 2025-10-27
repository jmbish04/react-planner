/**
 * Patch for demo/src/renderer.jsx to expose Redux store
 *
 * Add these lines to your renderer.jsx after creating the store:
 */

// After this line in renderer.jsx:
// let store = createStore(...)

// Add this code:
if (typeof window !== 'undefined') {
  window.__REDUX_STORE__ = store;
  window.__PLANNER_STORE__ = store;
  console.log('Redux store exposed to window.__REDUX_STORE__');
}

/**
 * Alternative: Complete modified renderer.jsx
 * Copy this file as demo/src/renderer-container.jsx for container builds
 */

export const CONTAINER_RENDERER_CODE = `
import React from 'react';
import ReactDOM from 'react-dom';
import ContainerDimensions from 'react-container-dimensions';
import Immutable, {Map} from 'immutable';
import immutableDevtools from 'immutable-devtools';
import {createStore} from 'redux';
import {Provider} from 'react-redux';

import MyCatalog from './catalog/mycatalog';
import ToolbarScreenshotButton from './ui/toolbar-screenshot-button';

import {
  Models as PlannerModels,
  reducer as PlannerReducer,
  ReactPlanner,
  Plugins as PlannerPlugins,
} from 'react-planner';

// Define state
let AppState = Map({
  'react-planner': new PlannerModels.State()
});

// Define reducer
let reducer = (state, action) => {
  state = state || AppState;
  state = state.update('react-planner', plannerState => PlannerReducer(plannerState, action));
  return state;
};

let blackList = isProduction === true ? [] : [
  'UPDATE_MOUSE_COORDS',
  'UPDATE_ZOOM_SCALE',
  'UPDATE_2D_CAMERA'
];

if (!isProduction) {
  console.info('Environment is in development and these actions will be blacklisted', blackList);
  console.info('Enable Chrome custom formatter for Immutable pretty print');
  immutableDevtools(Immutable);
}

// Init store
let store = createStore(
  reducer,
  null,
  !isProduction && window.devToolsExtension ?
    window.devToolsExtension({
      features: {
        pause: true,
        lock: true,
        persist: true,
        export: true,
        import: 'custom',
        jump: true,
        skip: true,
        reorder: true,
        dispatch: true,
        test: true
      },
      actionsBlacklist: blackList,
      maxAge: 999999
    }) :
    f => f
);

// EXPOSE STORE FOR CONTAINER ACCESS
if (typeof window !== 'undefined') {
  window.__REDUX_STORE__ = store;
  window.__PLANNER_STORE__ = store;

  // Also expose helper API
  window.__PLANNER_API__ = {
    getState: () => {
      const state = store.getState();
      return state.toJS ? state.toJS() : state;
    },
    dispatch: (action) => store.dispatch(action),
    subscribe: (listener) => store.subscribe(listener),
    getPlannerState: () => {
      const fullState = store.getState();
      const plannerState = fullState.get('react-planner');
      return plannerState.toJS ? plannerState.toJS() : plannerState;
    }
  };

  console.log('Redux store and Planner API exposed for container access');
}

let plugins = [
  PlannerPlugins.Keyboard(),
  PlannerPlugins.Autosave('react-planner_v0'),
  PlannerPlugins.ConsoleDebugger(),
];

let toolbarButtons = [
  ToolbarScreenshotButton,
];

// Render
ReactDOM.render(
  (
    <Provider store={store}>
      <ContainerDimensions>
        {({width, height}) =>
          <ReactPlanner
            catalog={MyCatalog}
            width={width}
            height={height}
            plugins={plugins}
            toolbarButtons={toolbarButtons}
            stateExtractor={state => state.get('react-planner')}
          />
        }
      </ContainerDimensions>
    </Provider>
  ),
  document.getElementById('app')
);
`;
