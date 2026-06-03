window.addEventListener('error', function (event) {
    console.error('Global Error:', event.error || event.message);
});
window.addEventListener('unhandledrejection', function (event) {
    console.error('Unhandled Rejection:', event.reason);
});

import "regenerator-runtime/runtime";
import 'babel-polyfill';
import React from 'react';
import ReactDOM from 'react-dom';
import ContainerDimensions from 'react-container-dimensions';
import { Map } from 'immutable';
import { createStore } from 'redux';
import { Provider } from 'react-redux';

import MyCatalog from './catalog/mycatalog';

import {
    Models as PlannerModels,
    reducer as PlannerReducer,
    ReactPlanner,
    Plugins as PlannerPlugins,
    ReactPlannerActions,
} from 'react-planner';

console.log('Canvas app starting...');

let AppState = Map({ 'react-planner': new PlannerModels.State() });

let reducer = (state, action) => {
    state = state || AppState;
    state = state.update('react-planner', plannerState => PlannerReducer(plannerState, action));
    return state;
};

let store = createStore(reducer, null);

let plugins = [
    PlannerPlugins.Keyboard(),
    PlannerPlugins.Autosave('smart-architect_v1'),
    PlannerPlugins.ConsoleDebugger(),
];

// ---------------------------------------------------------------------------
// Blueprint bus: the seam between the React-16 canvas and the React-18 chat
// sidebar. The sidebar talks to the Cloudflare agent and applies the agent's
// scene edits here; it also reads the current scene to sync manual edits up.
// ---------------------------------------------------------------------------
let applyingRemote = false;

function getScene() {
    const plannerState = store.getState().get('react-planner');
    return plannerState.get('scene').toJS();
}

function loadScene(scene) {
    applyingRemote = true;
    try {
        store.dispatch(ReactPlannerActions.projectActions.loadProject(scene));
    } finally {
        // release on next tick so the store.subscribe handler skips this change
        setTimeout(() => { applyingRemote = false; }, 0);
    }
}

const sceneListeners = new Set();
let lastSceneJSON = null;
store.subscribe(() => {
    if (applyingRemote) return;
    const scene = getScene();
    const json = JSON.stringify(scene);
    if (json === lastSceneJSON) return;
    lastSceneJSON = json;
    sceneListeners.forEach(fn => { try { fn(scene); } catch (e) { console.error(e); } });
});

window.__planner = {
    store,
    actions: ReactPlannerActions,
    getScene,
    loadScene,
    // subscribe(fn) -> unsubscribe; fires when the human edits the canvas
    onSceneChange(fn) { sceneListeners.add(fn); return () => sceneListeners.delete(fn); },
};
window.dispatchEvent(new Event('planner-ready'));

ReactDOM.render(
    <Provider store={store}>
        <div style={{ width: '100%', height: '100%', position: 'relative' }}>
            <ContainerDimensions>
                {({ width, height }) =>
                    <ReactPlanner
                        catalog={MyCatalog}
                        width={width}
                        height={height}
                        plugins={plugins}
                        stateExtractor={state => state.get('react-planner')}
                    />}
            </ContainerDimensions>
        </div>
    </Provider>,
    document.getElementById('canvas')
);
console.log('Canvas app rendered');
