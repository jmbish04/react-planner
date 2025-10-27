/**
 * Store Exposer Script
 * This script should be injected into the react-planner HTML to expose the Redux store
 *
 * Add this to demo/src/renderer.jsx or inject via Puppeteer
 */

(function exposeReduxStore() {
  'use strict';

  // Try to find the store from various sources
  let storeFound = false;

  // Method 1: If you modify renderer.jsx to expose it
  if (window.__PLANNER_STORE__) {
    window.__REDUX_STORE__ = window.__PLANNER_STORE__;
    storeFound = true;
    console.log('Redux store exposed via __PLANNER_STORE__');
  }

  // Method 2: Via React DevTools hook
  if (!storeFound && window.__REACT_DEVTOOLS_GLOBAL_HOOK__) {
    const hook = window.__REACT_DEVTOOLS_GLOBAL_HOOK__;

    // Wait for React to mount
    const checkForStore = () => {
      if (hook.renderers && hook.renderers.size > 0) {
        const renderer = Array.from(hook.renderers.values())[0];

        if (renderer && renderer.findFiberByHostInstance) {
          const appElement = document.getElementById('app');
          if (appElement && appElement._reactRootContainer) {
            const fiber = appElement._reactRootContainer._internalRoot.current;

            // Traverse fiber tree to find Provider
            let current = fiber;
            while (current && !window.__REDUX_STORE__) {
              if (current.memoizedProps && current.memoizedProps.store) {
                window.__REDUX_STORE__ = current.memoizedProps.store;
                storeFound = true;
                console.log('Redux store exposed via React fiber tree');
                break;
              }
              current = current.child;
            }
          }
        }
      }

      if (!storeFound) {
        setTimeout(checkForStore, 100);
      }
    };

    checkForStore();
  }

  // Method 3: Intercept Redux store creation
  if (!storeFound) {
    const originalCreateStore = window.Redux?.createStore;
    if (originalCreateStore) {
      window.Redux.createStore = function(...args) {
        const store = originalCreateStore.apply(this, args);
        window.__REDUX_STORE__ = store;
        console.log('Redux store exposed via intercepted createStore');
        return store;
      };
    }
  }

  // Expose helper functions
  window.__PLANNER_API__ = {
    getState: () => {
      if (!window.__REDUX_STORE__) {
        throw new Error('Redux store not available');
      }
      const state = window.__REDUX_STORE__.getState();
      // Convert Immutable to plain JS
      return state.toJS ? state.toJS() : state;
    },

    dispatch: (action) => {
      if (!window.__REDUX_STORE__) {
        throw new Error('Redux store not available');
      }
      return window.__REDUX_STORE__.dispatch(action);
    },

    subscribe: (listener) => {
      if (!window.__REDUX_STORE__) {
        throw new Error('Redux store not available');
      }
      return window.__REDUX_STORE__.subscribe(listener);
    },

    // Helper to get the react-planner state
    getPlannerState: () => {
      const fullState = window.__PLANNER_API__.getState();
      return fullState['react-planner'];
    }
  };

  console.log('Planner API exposed on window.__PLANNER_API__');
})();
