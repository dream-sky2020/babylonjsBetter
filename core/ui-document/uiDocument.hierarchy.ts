import type { UiDocument } from './uiDocument.types.ts';
import { resolveUiNodeLayout, setUiNodeWorldRect } from './uiDocument.layout.ts';

export const canReparentUiNode = (document: UiDocument, nodeId: string, parentId: string | null): boolean => {
  if (!document.nodes[nodeId] || resolveUiNodeLayout(document, nodeId)?.locked) return false;
  if (parentId && (!document.nodes[parentId] || resolveUiNodeLayout(document, parentId)?.locked)) return false;
  const visited = new Set<string>();
  for (let id = parentId; id; id = document.nodes[id]?.parentId ?? null) {
    if (id === nodeId || visited.has(id)) return false;
    visited.add(id);
  }
  return true;
};

/** Reparent without changing layout mode, anchors, or descendants. */
export const reparentUiNode = (document: UiDocument, nodeId: string, parentId: string | null, keepWorldPosition = true): void => {
  if (!canReparentUiNode(document, nodeId, parentId)) throw new Error('父节点无效、已锁定或会产生循环关系。');
  const node = document.nodes[nodeId];
  if (node.parentId === parentId) return;
  const world = resolveUiNodeLayout(document, node)?.layout;
  if (node.parentId) document.nodes[node.parentId].childIds = document.nodes[node.parentId].childIds.filter(id => id !== nodeId);
  else document.rootIds = document.rootIds.filter(id => id !== nodeId);
  node.parentId = parentId;
  (parentId ? document.nodes[parentId].childIds : document.rootIds).push(nodeId);
  if (world && keepWorldPosition) setUiNodeWorldRect(document, node, world);
};

/** Duplicate the whole subtree beside its source, with fresh IDs and intact bindings. */
export const duplicateUiSubtree = (document: UiDocument, nodeId: string): string => {
  const source = document.nodes[nodeId];
  if (!source) throw new Error('复制的节点不存在。');
  const copy = (id: string, parentId: string | null): string => {
    const original = document.nodes[id];
    let nextId = `${id}-copy`; let suffix = 1;
    while (document.nodes[nextId]) nextId = `${id}-copy-${++suffix}`;
    const node = structuredClone(original);
    node.id = nextId; node.parentId = parentId; node.name = `${original.name} 副本`; node.childIds = [];
    document.nodes[nextId] = node;
    node.childIds = original.childIds.map(childId => copy(childId, nextId));
    return nextId;
  };
  const id = copy(nodeId, source.parentId); const node = document.nodes[id];
  const siblings = source.parentId ? document.nodes[source.parentId].childIds : document.rootIds;
  siblings.splice(siblings.indexOf(nodeId) + 1, 0, id);
  if (node.layout.mode === 'absolute') { node.layout.x += 24; node.layout.y += 24; }
  else { node.layout.anchoredPosition.x += 24; node.layout.anchoredPosition.y += 24; }
  return id;
};
