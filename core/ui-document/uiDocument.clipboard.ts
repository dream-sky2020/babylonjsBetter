import type { UiDocument, UiNode } from './uiDocument.types.ts';
import { resolveUiNodeLayout, setUiNodeWorldRect } from './uiDocument.layout.ts';

type Rect = { x: number; y: number; width: number; height: number };
export type UiNodeClipboard = { roots: string[]; nodes: Record<string, UiNode>; rects: Record<string, Rect>; bounds: Rect };
export function uiSelectionRoots(document: UiDocument, ids: readonly string[]): string[] {
  const selected = new Set(ids.filter(id => Boolean(document.nodes[id])));
  return [...selected].filter(id => {
    for (let parent = document.nodes[id].parentId; parent; parent = document.nodes[parent]?.parentId ?? null) if (selected.has(parent)) return false;
    return true;
  });
}
const descendants = (document: Pick<UiDocument, 'nodes'>, roots: readonly string[]): string[] => {
  const result: string[] = [];
  const visit = (id: string) => { result.push(id); document.nodes[id].childIds.forEach(visit); };
  roots.forEach(visit); return result;
};
export function copyUiNodes(document: UiDocument, ids: readonly string[]): UiNodeClipboard | null {
  const roots = uiSelectionRoots(document, ids).sort((a, b) => resolveUiNodeLayout(document, a)!.layout.zIndex - resolveUiNodeLayout(document, b)!.layout.zIndex); if (!roots.length) return null;
  const rects = Object.fromEntries(roots.map(id => [id, { ...resolveUiNodeLayout(document, id)!.layout }]));
  const x = Math.min(...roots.map(id => rects[id].x)); const y = Math.min(...roots.map(id => rects[id].y));
  const right = Math.max(...roots.map(id => rects[id].x + rects[id].width)); const bottom = Math.max(...roots.map(id => rects[id].y + rects[id].height));
  return { roots, rects, bounds: { x, y, width: right - x, height: bottom - y }, nodes: Object.fromEntries(descendants(document, roots).map(id => [id, structuredClone(document.nodes[id])])) };
}
export function canRemoveUiNodes(document: UiDocument, ids: readonly string[]): boolean {
  const roots = uiSelectionRoots(document, ids);
  return roots.length > 0 && descendants(document, roots).every(id => !resolveUiNodeLayout(document, id)?.locked);
}
/** One mutation deletes the union of selected subtrees; locked descendants block it. */
export function removeUiNodes(document: UiDocument, ids: readonly string[]): void {
  if (!canRemoveUiNodes(document, ids)) throw new Error('选区或其子节点已锁定，不能剪切或删除。');
  const roots = uiSelectionRoots(document, ids); const removed = descendants(document, roots);
  for (const id of roots) {
    const node = document.nodes[id];
    if (node.parentId) document.nodes[node.parentId].childIds = document.nodes[node.parentId].childIds.filter(child => child !== id);
    else document.rootIds = document.rootIds.filter(root => root !== id);
  }
  removed.forEach(id => { delete document.nodes[id]; });
}
export function canPasteUiNodes(document: UiDocument, parentId: string | null): boolean {
  return parentId === null || Boolean(document.nodes[parentId] && !resolveUiNodeLayout(document, parentId)?.locked);
}
/** Fresh identities for copies; cuts can retain unused IDs. Root placement preserves group spacing. */
export function pasteUiNodes(document: UiDocument, clipboard: UiNodeClipboard, parentId: string | null = null, point?: { x: number; y: number }, preserveIds = false): string[] {
  if (!canPasteUiNodes(document, parentId)) throw new Error('粘贴目标不存在或已锁定。');
  const parent = parentId ? resolveUiNodeLayout(document, parentId)!.layout : null;
  const { bounds } = clipboard;
  const center = point ?? (parent ? { x: parent.x + parent.width / 2, y: parent.y + parent.height / 2 } : { x: bounds.x + bounds.width / 2 + 24, y: bounds.y + bounds.height / 2 + 24 });
  const dx = center.x - bounds.x - bounds.width / 2; const dy = center.y - bounds.y - bounds.height / 2;
  const siblings = parentId ? document.nodes[parentId].childIds : document.rootIds;
  const topZ = Math.max(-1, ...siblings.map(id => document.nodes[id].layout.zIndex));
  const copy = (sourceId: string, parentId: string | null): string => {
    let id = preserveIds && !document.nodes[sourceId] ? sourceId : `${sourceId}-copy`; let index = 1;
    while (document.nodes[id]) id = `${sourceId}-copy-${++index}`;
    const node = structuredClone(clipboard.nodes[sourceId]);
    node.id = id; node.parentId = parentId; if (!preserveIds) node.name += ' 副本'; node.childIds = [];
    document.nodes[id] = node;
    node.childIds = clipboard.nodes[sourceId].childIds.map(child => copy(child, id));
    return id;
  };
  return clipboard.roots.map((sourceId, index) => {
    const id = copy(sourceId, parentId); siblings.push(id);
    const rect = clipboard.rects[sourceId];
    setUiNodeWorldRect(document, document.nodes[id], { ...rect, x: rect.x + dx, y: rect.y + dy });
    document.nodes[id].layout.zIndex = topZ + index + 1;
    return id;
  });
}
