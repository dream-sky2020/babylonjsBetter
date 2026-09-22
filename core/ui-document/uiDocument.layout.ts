import type { UiAbsoluteLayout, UiDocument, UiNode, UiRectTransformLayout, UiResolvedNode } from './uiDocument.types.ts';

export type UiRect = Pick<UiAbsoluteLayout, 'x' | 'y' | 'width' | 'height'>;

export const getUiSafeAreaRect = (document: UiDocument): UiRect => {
  const area = document.canvas.safeArea ?? { top: 0, right: 0, bottom: 0, left: 0 };
  return { x: area.left, y: area.top, width: Math.max(8, document.canvas.width - area.left - area.right), height: Math.max(8, document.canvas.height - area.top - area.bottom) };
};

const canvasRect = (document: UiDocument): UiRect => ({ x: 0, y: 0, width: document.canvas.width, height: document.canvas.height });

export const getUiLayoutParentRect = (document: UiDocument, node: UiNode, visited = new Set<string>()): UiRect | undefined => {
  if (node.parentId) return resolveUiNodeLayout(document, node.parentId, visited)?.layout;
  return node.layout.mode === 'rect-transform' && node.layout.relativeTo === 'safe-area' ? getUiSafeAreaRect(document) : canvasRect(document);
};

export const resolveUiNodeLayout = (document: UiDocument, nodeOrId: UiNode | string, visited = new Set<string>()): UiResolvedNode | undefined => {
  const source = typeof nodeOrId === 'string' ? document.nodes[nodeOrId] : nodeOrId;
  if (!source || visited.has(source.id)) return undefined;
  const nextVisited = new Set(visited).add(source.id);
  const parent = source.parentId ? resolveUiNodeLayout(document, source.parentId, nextVisited) : undefined;
  if (source.parentId && !parent) return undefined;
  const parentRect = getUiLayoutParentRect(document, source, nextVisited); if (!parentRect) return undefined;
  let layout: UiAbsoluteLayout;
  if (source.layout.mode === 'absolute') layout = { ...source.layout, x: parentRect.x + source.layout.x, y: parentRect.y + source.layout.y };
  else {
    const { anchorMin, anchorMax, pivot, anchoredPosition, sizeDelta, zIndex } = source.layout;
    const width = Math.max(8, parentRect.width * (anchorMax.x - anchorMin.x) + sizeDelta.x);
    const height = Math.max(8, parentRect.height * (anchorMax.y - anchorMin.y) + sizeDelta.y);
    const anchorX = parentRect.x + parentRect.width * (anchorMin.x + (anchorMax.x - anchorMin.x) * pivot.x);
    const anchorY = parentRect.y + parentRect.height * (anchorMin.y + (anchorMax.y - anchorMin.y) * pivot.y);
    layout = { mode: 'absolute', x: anchorX + anchoredPosition.x - width * pivot.x, y: anchorY + anchoredPosition.y - height * pivot.y, width, height, zIndex };
  }
  return { ...source, visible: source.visible && (parent?.visible ?? true), locked: source.locked || (parent?.locked ?? false), opacity: source.opacity * (parent?.opacity ?? 1), layout };
};

export const setUiNodeWorldRect = (document: UiDocument, node: UiNode, rect: UiRect): void => {
  const parentRect = getUiLayoutParentRect(document, node); if (!parentRect) return;
  if (node.layout.mode === 'absolute') {
    node.layout.x = Math.round(rect.x - parentRect.x); node.layout.y = Math.round(rect.y - parentRect.y);
    node.layout.width = Math.max(8, Math.round(rect.width)); node.layout.height = Math.max(8, Math.round(rect.height)); return;
  }
  const { anchorMin, anchorMax, pivot } = node.layout; const width = Math.max(8, rect.width); const height = Math.max(8, rect.height);
  const anchorX = parentRect.x + parentRect.width * (anchorMin.x + (anchorMax.x - anchorMin.x) * pivot.x);
  const anchorY = parentRect.y + parentRect.height * (anchorMin.y + (anchorMax.y - anchorMin.y) * pivot.y);
  node.layout.sizeDelta.x = Math.round(width - parentRect.width * (anchorMax.x - anchorMin.x)); node.layout.sizeDelta.y = Math.round(height - parentRect.height * (anchorMax.y - anchorMin.y));
  node.layout.anchoredPosition.x = Math.round(rect.x + width * pivot.x - anchorX); node.layout.anchoredPosition.y = Math.round(rect.y + height * pivot.y - anchorY);
};

export const convertUiNodeToRectTransform = (document: UiDocument, node: UiNode, anchorMin = { x: .5, y: .5 }, anchorMax = anchorMin): void => {
  const resolved = resolveUiNodeLayout(document, node); if (!resolved) return; const zIndex = node.layout.zIndex;
  node.layout = { mode: 'rect-transform', anchorMin: { ...anchorMin }, anchorMax: { ...anchorMax }, pivot: { x: .5, y: .5 }, anchoredPosition: { x: 0, y: 0 }, sizeDelta: { x: resolved.layout.width, y: resolved.layout.height }, relativeTo: 'parent', zIndex };
  setUiNodeWorldRect(document, node, resolved.layout);
};

export const convertUiNodeToAbsolute = (document: UiDocument, node: UiNode): void => {
  const resolved = resolveUiNodeLayout(document, node); if (!resolved) return; const parentRect = getUiLayoutParentRect(document, node); if (!parentRect) return;
  node.layout = { mode: 'absolute', x: Math.round(resolved.layout.x - parentRect.x), y: Math.round(resolved.layout.y - parentRect.y), width: Math.round(resolved.layout.width), height: Math.round(resolved.layout.height), zIndex: node.layout.zIndex };
};

export const applyUiAnchorPreset = (document: UiDocument, node: UiNode, anchorMin: { x: number; y: number }, anchorMax = anchorMin): void => {
  if (node.layout.mode !== 'rect-transform') convertUiNodeToRectTransform(document, node, anchorMin, anchorMax);
  else { const resolved = resolveUiNodeLayout(document, node); if (!resolved) return; node.layout.anchorMin = { ...anchorMin }; node.layout.anchorMax = { ...anchorMax }; setUiNodeWorldRect(document, node, resolved.layout); }
};

export const isUiRectTransformLayout = (layout: UiNode['layout']): layout is UiRectTransformLayout => layout.mode === 'rect-transform';
