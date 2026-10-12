export type GraphPoint = { x: number; y: number };
export type GraphView = GraphPoint & { scale: number };
export type GraphRect = GraphPoint & { width: number; height: number };

export const graphWorldPoint = (point: GraphPoint, view: GraphView): GraphPoint => ({
  x: (point.x - view.x) / view.scale, y: (point.y - view.y) / view.scale,
});
export const graphScreenPoint = (point: GraphPoint, view: GraphView): GraphPoint => ({
  x: view.x + point.x * view.scale, y: view.y + point.y * view.scale,
});

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
