export type PanelId = 'objects' | 'materials' | 'textures';
export type DockNode = PanelId | { id: string; axis: 'x' | 'y'; ratio: number; first: DockNode; second: DockNode };
export const panels: PanelId[] = ['objects', 'materials', 'textures'];
export const defaultDockTree: DockNode = { id: 'main', axis: 'x', ratio: 0.55, first: 'objects', second: { id: 'resources', axis: 'y', ratio: 0.5, first: 'materials', second: 'textures' } };
export function dockLeaves(node: DockNode): PanelId[] { return typeof node === 'string' ? [node] : [...dockLeaves(node.first), ...dockLeaves(node.second)]; }
export function validateDockTree(value: unknown): DockNode {
  const seen = new Set<string>(), ids = new Set<string>();
  function read(node: any, depth: number): DockNode {
    if (typeof node === 'string' && panels.includes(node as PanelId) && !seen.has(node)) { seen.add(node); return node as PanelId; }
    if (!node || typeof node !== 'object' || depth > 3 || !['x', 'y'].includes(node.axis) || typeof node.id !== 'string' || ids.has(node.id) || !Number.isFinite(node.ratio)) throw new Error('invalid layout');
    ids.add(node.id); return { id: node.id, axis: node.axis, ratio: Math.max(0.15, Math.min(0.85, node.ratio)), first: read(node.first, depth + 1), second: read(node.second, depth + 1) };
  }
  try { const tree = read(value, 0); return seen.size === 3 ? tree : defaultDockTree; } catch { return defaultDockTree; }
}
export function removeDockPanel(node: DockNode, panel: PanelId): DockNode | null {
  if (typeof node === 'string') return node === panel ? null : node;
  const first = removeDockPanel(node.first, panel), second = removeDockPanel(node.second, panel);
  return first && second ? { ...node, first, second } : first ?? second;
}
export function moveDockPanel(tree: DockNode, source: PanelId, target: PanelId, edge: 'left' | 'right' | 'top' | 'bottom'): DockNode {
  if (source === target) return tree;
  const remaining = removeDockPanel(tree, source)!;
  const ids = new Set<string>();
  const collect = (node: DockNode) => { if (typeof node !== 'string') { ids.add(node.id); collect(node.first); collect(node.second); } }; collect(remaining);
  let newId = `dock-${source}-${target}`; while (ids.has(newId)) newId += '-new';
  function insert(node: DockNode): DockNode {
    if (typeof node !== 'string') return { ...node, first: insert(node.first), second: insert(node.second) };
    if (node !== target) return node;
    const before = edge === 'left' || edge === 'top';
    return { id: newId, axis: edge === 'left' || edge === 'right' ? 'x' : 'y', ratio: 0.5, first: before ? source : target, second: before ? target : source };
  }
  return insert(remaining);
}
export function setDockRatio(tree: DockNode, id: string, ratio: number): DockNode {
  return typeof tree === 'string' ? tree : { ...tree, ratio: tree.id === id ? Math.max(0.15, Math.min(0.85, ratio)) : tree.ratio, first: setDockRatio(tree.first, id, ratio), second: setDockRatio(tree.second, id, ratio) };
}
export type DockRect = { x: number; y: number; w: number; h: number };
export function dockRects(tree: DockNode, visible: PanelId[]) {
  const leaves = new Map<PanelId, DockRect>(), splits: { id: string; axis: 'x' | 'y'; ratio: number; rect: DockRect }[] = [];
  function prune(node: DockNode): DockNode | null {
    if (typeof node === 'string') return visible.includes(node) ? node : null;
    const first = prune(node.first), second = prune(node.second);
    return first && second ? { ...node, first, second } : first ?? second;
  }
  function visit(node: DockNode, rect: DockRect) {
    if (typeof node === 'string') { leaves.set(node, rect); return; }
    splits.push({ id: node.id, axis: node.axis, ratio: node.ratio, rect });
    visit(node.first, node.axis === 'x' ? { ...rect, w: rect.w * node.ratio } : { ...rect, h: rect.h * node.ratio });
    visit(node.second, node.axis === 'x' ? { ...rect, x: rect.x + rect.w * node.ratio, w: rect.w * (1 - node.ratio) } : { ...rect, y: rect.y + rect.h * node.ratio, h: rect.h * (1 - node.ratio) });
  }
  const active = prune(tree); if (active) visit(active, { x: 0, y: 0, w: 1, h: 1 });
  return { leaves, splits };
}
