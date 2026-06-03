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

// No Autosave plugin: the BlueprintAgent Durable Object (synced over WebSocket)
// plus D1 versioning are the source of truth. localStorage autosave would
// restore un-normalized scenes via its own loadProject, bypassing normalizeScene.
let plugins = [
    PlannerPlugins.Keyboard(),
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

// Agent-produced elements often omit per-element properties (e.g. a door's
// width/height/thickness). react-planner element renderers read those directly
// (element.properties.get('width').get('length')) and crash on missing values.
// Normalize against the real catalog: fill any missing property with the
// catalog element's defaultValue. The catalog is the single source of truth, so
// the agent never has to know each element's property schema.
function normalizeScene(scene) {
    const elements = (MyCatalog && MyCatalog.elements) || {};
    Object.values(scene.layers || {}).forEach(layer => {
        ['lines', 'holes', 'items', 'areas'].forEach(coll => {
            Object.values(layer[coll] || {}).forEach(el => {
                const def = elements[el.type];
                if (!def || !def.properties) return;
                el.properties = el.properties || {};
                Object.keys(def.properties).forEach(key => {
                    const spec = def.properties[key];
                    if (el.properties[key] === undefined && spec && spec.defaultValue !== undefined) {
                        el.properties[key] = spec.defaultValue;
                    }
                });
            });
        });
    });
    return scene;
}

function loadScene(scene) {
    applyingRemote = true;
    try {
        store.dispatch(ReactPlannerActions.projectActions.loadProject(normalizeScene(scene)));
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
