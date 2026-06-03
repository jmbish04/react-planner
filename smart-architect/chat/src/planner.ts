// Typed accessor to the blueprint bus exposed by the React-16 canvas app
// (see ../../src/index.js -> window.__planner).

export type Scene = Record<string, unknown>;

interface PlannerBus {
  getScene: () => Scene;
  loadScene: (scene: Scene) => void;
  onSceneChange: (fn: (scene: Scene) => void) => () => void;
}

declare global {
  interface Window {
    __planner?: PlannerBus;
  }
}

export function onPlannerReady(cb: () => void): () => void {
  if (window.__planner) {
    cb();
    return () => {};
  }
  const handler = () => cb();
  window.addEventListener('planner-ready', handler, { once: true });
  return () => window.removeEventListener('planner-ready', handler);
}

export function applyScene(scene: Scene): void {
  window.__planner?.loadScene(scene);
}

export function readScene(): Scene | null {
  return window.__planner?.getScene() ?? null;
}

export function subscribeSceneChange(fn: (scene: Scene) => void): () => void {
  return window.__planner?.onSceneChange(fn) ?? (() => {});
}
