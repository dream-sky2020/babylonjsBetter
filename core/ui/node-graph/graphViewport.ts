export type GraphPoint = { x: number; y: number };
export type GraphView = GraphPoint & { scale: number };
export type GraphRect = GraphPoint & { width: number; height: number };

export const graphWorldPoint = (point: GraphPoint, view: GraphView): GraphPoint => ({
  x: (point.x - view.x) / view.scale, y: (point.y - view.y) / view.scale,
});
export const graphScreenPoint = (point: GraphPoint, view: GraphView): GraphPoint => ({
  x: view.x + point.x * view.scale, y: view.y + point.y * view.scale,
});

/** Keep the world point underneath a CSS-pixel canvas position stationary. */
export const zoomGraphViewAtPoint = (
  view: GraphView, anchor: GraphPoint, scale: number, minScale = .3, maxScale = 2.2,
): GraphView => {
  if (!Number.isFinite(scale) || !Number.isFinite(anchor.x) || !Number.isFinite(anchor.y) || !(view.scale > 0)) return view;
  const nextScale = Math.min(maxScale, Math.max(minScale, scale));
  if (nextScale === view.scale) return view;
  const world = graphWorldPoint(anchor, view);
  return { scale: nextScale, x: anchor.x - world.x * nextScale, y: anchor.y - world.y * nextScale };
};

export const normalizeGraphWheelDelta = (wheel: { deltaY: number; deltaMode: number }, viewportHeight: number): number => {
  if (!Number.isFinite(wheel.deltaY)) return 0;
  const unit = wheel.deltaMode === 1 ? 16 : wheel.deltaMode === 2 ? Math.max(1, viewportHeight) : 1;
  return Math.min(200, Math.max(-200, wheel.deltaY * unit));
};

/** Exponential zoom is continuous for touchpads and symmetric for opposite wheel steps. */
export const zoomGraphViewWithWheel = (
  view: GraphView, anchor: GraphPoint, wheel: { deltaY: number; deltaMode: number }, viewportHeight: number,
): GraphView => {
  const delta = normalizeGraphWheelDelta(wheel, viewportHeight);
  if (!delta) return view;
  return zoomGraphViewAtPoint(view, anchor, view.scale * Math.exp(-delta * .001));
};

/** Shared by the dialogue canvas and Lab system graph. */
export const fitGraphView = (
  nodes: readonly GraphRect[], size: { width: number; height: number }, minScale = 0.3,
): GraphView => {
  if (!nodes.length) return { x: 48, y: 48, scale: 1 };
  const minX = Math.min(...nodes.map(n => n.x));
  const minY = Math.min(...nodes.map(n => n.y));
  const width = Math.max(...nodes.map(n => n.x + n.width)) - minX;
  const height = Math.max(...nodes.map(n => n.y + n.height)) - minY;
  const scale = Math.min(1.1, Math.max(minScale, Math.min(
    (size.width - 96) / Math.max(1, width), (size.height - 96) / Math.max(1, height),
  )));
  return { x: (size.width - width * scale) / 2 - minX * scale, y: (size.height - height * scale) / 2 - minY * scale, scale };
};
