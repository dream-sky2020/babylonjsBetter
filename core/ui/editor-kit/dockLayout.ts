export type DockNode<P extends string = string> = P | { id: string; axis: 'x' | 'y'; ratio: number; first: DockNode<P>; second: DockNode<P> };
export type DockEdge = 'left' | 'right' | 'top' | 'bottom';
export type DockRect = { x: number; y: number; w: number; h: number };
export function dockLeaves<P extends string>(node: DockNode<P>): P[] {
  return typeof node === 'string' ? [node] : [...dockLeaves(node.first), ...dockLeaves(node.second)];
}
export function validateDockTree<P extends string>(value: unknown, panels: readonly P[], fallback: DockNode<P>): DockNode<P> {
  const seen = new Set<string>(), ids = new Set<string>();
  const read = (node: unknown, depth: number): DockNode<P> => {
    if (typeof node === 'string' && panels.includes(node as P) && !seen.has(node)) { seen.add(node); return node as P; }
    if (!node || typeof node !== 'object' || depth >= panels.length) throw new Error('invalid layout');
    const row = node as Record<string, unknown>;
    if ((row.axis !== 'x' && row.axis !== 'y') || typeof row.id !== 'string' || ids.has(row.id) || typeof row.ratio !== 'number' || !Number.isFinite(row.ratio)) throw new Error('invalid split');
    ids.add(row.id);
    return { id: row.id, axis: row.axis, ratio: Math.max(.15, Math.min(.85, row.ratio)), first: read(row.first, depth + 1), second: read(row.second, depth + 1) };
  };
  try { const tree = read(value, 0); return seen.size === panels.length ? tree : fallback; } catch { return fallback; }
}
export function removeDockPanel<P extends string>(node: DockNode<P>, panel: P): DockNode<P> | null {
  if (typeof node === 'string') return node === panel ? null : node;
  const first = removeDockPanel(node.first, panel), second = removeDockPanel(node.second, panel);
  return first && second ? { ...node, first, second } : first ?? second;
}
export function moveDockPanel<P extends string>(tree: DockNode<P>, source: P, target: P, edge: DockEdge): DockNode<P> {
  const leaves = dockLeaves(tree);
  if (source === target || !leaves.includes(source) || !leaves.includes(target)) return tree;
  const remaining = removeDockPanel(tree, source)!;
  const ids = new Set<string>();
  const collect = (node: DockNode<P>) => { if (typeof node !== 'string') { ids.add(node.id); collect(node.first); collect(node.second); } }; collect(remaining);
  let id = `dock-${source}-${target}`; while (ids.has(id)) id += '-new';
  const insert = (node: DockNode<P>): DockNode<P> => {
    if (typeof node !== 'string') return { ...node, first: insert(node.first), second: insert(node.second) };
    if (node !== target) return node;
    const before = edge === 'left' || edge === 'top';
    return { id, axis: edge === 'left' || edge === 'right' ? 'x' : 'y', ratio: .5, first: before ? source : target, second: before ? target : source };
  };
  return insert(remaining);
}
export function setDockRatio<P extends string>(tree: DockNode<P>, id: string, ratio: number): DockNode<P> {
  if (!Number.isFinite(ratio)) return tree;
  return typeof tree === 'string' ? tree : { ...tree, ratio: tree.id === id ? Math.max(.15, Math.min(.85, ratio)) : tree.ratio, first: setDockRatio(tree.first, id, ratio), second: setDockRatio(tree.second, id, ratio) };
}
export function arrangeDockPanels<P extends string>(panels: readonly P[], axis: 'x' | 'y'): DockNode<P> {
  if (!panels.length) throw new Error('A dock needs at least one panel');
  if (panels.length === 1) return panels[0];
  return { id: `arrange-${panels[0]}`, axis, ratio: 1 / panels.length, first: panels[0], second: arrangeDockPanels(panels.slice(1), axis) };
}
export function dockRects<P extends string>(tree: DockNode<P>, visible: readonly P[]) {
  const leaves = new Map<P, DockRect>(), splits: { id: string; axis: 'x' | 'y'; ratio: number; rect: DockRect }[] = [];
  const prune = (node: DockNode<P>): DockNode<P> | null => {
    if (typeof node === 'string') return visible.includes(node) ? node : null;
    const first = prune(node.first), second = prune(node.second);
    return first && second ? { ...node, first, second } : first ?? second;
  };
  const visit = (node: DockNode<P>, rect: DockRect) => {
    if (typeof node === 'string') { leaves.set(node, rect); return; }
    splits.push({ id: node.id, axis: node.axis, ratio: node.ratio, rect });
    visit(node.first, node.axis === 'x' ? { ...rect, w: rect.w * node.ratio } : { ...rect, h: rect.h * node.ratio });
    visit(node.second, node.axis === 'x' ? { ...rect, x: rect.x + rect.w * node.ratio, w: rect.w * (1 - node.ratio) } : { ...rect, y: rect.y + rect.h * node.ratio, h: rect.h * (1 - node.ratio) });
  };
  const active = prune(tree); if (active) visit(active, { x: 0, y: 0, w: 1, h: 1 });
  return { leaves, splits };
}
