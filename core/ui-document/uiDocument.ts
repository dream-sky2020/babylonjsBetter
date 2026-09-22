import type { UiCanvasSettings, UiDocument, UiDocumentLibrary, UiNode } from './uiDocument.types.ts';

const DEFAULT_CANVAS: UiCanvasSettings = { width: 1600, height: 900, backgroundTop: '#101a35', backgroundBottom: '#24162e', gridSize: 20 };
const isObject = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const stringValue = (value: unknown, fallback: string) => typeof value === 'string' ? value : fallback;
const numberValue = (value: unknown, fallback: number) => typeof value === 'number' && Number.isFinite(value) ? value : fallback;
const objectValue = (value: unknown): Record<string, unknown> => isObject(value) ? structuredClone(value) : {};
const pointValue = (value: unknown, fallback: { x: number; y: number }) => {
  const point = isObject(value) ? value : {};
  return { x: numberValue(point.x, fallback.x), y: numberValue(point.y, fallback.y) };
};

const parseCanvas = (value: unknown): UiCanvasSettings => {
  const canvas = isObject(value) ? value : {};
  return {
    width: Math.max(320, numberValue(canvas.width, DEFAULT_CANVAS.width)),
    height: Math.max(180, numberValue(canvas.height, DEFAULT_CANVAS.height)),
    backgroundTop: stringValue(canvas.backgroundTop, DEFAULT_CANVAS.backgroundTop),
    backgroundBottom: stringValue(canvas.backgroundBottom, DEFAULT_CANVAS.backgroundBottom),
    gridSize: Math.max(4, numberValue(canvas.gridSize, DEFAULT_CANVAS.gridSize)),
    ...(isObject(canvas.safeArea) ? { safeArea: {
      top: Math.max(0, numberValue(canvas.safeArea.top, 0)), right: Math.max(0, numberValue(canvas.safeArea.right, 0)),
      bottom: Math.max(0, numberValue(canvas.safeArea.bottom, 0)), left: Math.max(0, numberValue(canvas.safeArea.left, 0)),
    } } : {}),
  };
};

export const migrateLegacyUiDocument = (value: Record<string, unknown>, expectedKey?: string): UiDocument => {
  const presetKey = stringValue(value.presetKey, expectedKey ?? '');
  if (!presetKey || (expectedKey && presetKey !== expectedKey)) throw new Error('UI 文档 Key 无效。');
  const components = Array.isArray(value.components) ? value.components : [];
  const nodes: Record<string, UiNode> = {};
  const rootIds: string[] = [];
  components.forEach((raw, index) => {
    if (!isObject(raw)) throw new Error(`组件 ${index + 1} 必须是对象。`);
    const id = stringValue(raw.id, `component-${index + 1}`);
    if (!id || nodes[id]) throw new Error(`组件 ID 重复或为空：${id || '（空）'}`);
    nodes[id] = {
      id, type: stringValue(raw.kind, 'missing-definition'), definitionVersion: 1,
      name: stringValue(raw.name, `组件 ${index + 1}`), parentId: null, childIds: [],
      layout: { mode: 'absolute', x: numberValue(raw.x, 0), y: numberValue(raw.y, 0), width: Math.max(8, numberValue(raw.width, 120)), height: Math.max(8, numberValue(raw.height, 48)), zIndex: numberValue(raw.zIndex, index) },
      visible: raw.visible !== false, locked: raw.locked === true,
      opacity: Math.min(1, Math.max(0, numberValue(raw.opacity, 1))),
      props: { content: stringValue(raw.content, ''), ...(typeof raw.icon === 'string' ? { icon: raw.icon } : {}), ...objectValue(raw.style) },
    };
    rootIds.push(id);
  });
  return { schemaVersion: 2, presetKey, name: stringValue(value.name, presetKey), canvas: parseCanvas(value.canvas), rootIds, nodes };
};

const parseNode = (value: unknown, key: string): UiNode => {
  if (!isObject(value)) throw new Error(`UI 节点 ${key} 必须是对象。`);
  const id = stringValue(value.id, key);
  if (id !== key) throw new Error(`UI 节点 Key 与 ID 不一致：${key}`);
  const layout = isObject(value.layout) ? value.layout : {};
  if (layout.mode !== undefined && layout.mode !== 'absolute' && layout.mode !== 'rect-transform') throw new Error(`UI 节点 ${id} 的布局模式暂不支持。`);
  const parsedLayout = layout.mode === 'rect-transform' ? {
    mode: 'rect-transform' as const,
    anchorMin: pointValue(layout.anchorMin, { x: .5, y: .5 }), anchorMax: pointValue(layout.anchorMax, { x: .5, y: .5 }),
    pivot: pointValue(layout.pivot, { x: .5, y: .5 }), anchoredPosition: pointValue(layout.anchoredPosition, { x: 0, y: 0 }),
    sizeDelta: pointValue(layout.sizeDelta, { x: 120, y: 48 }), relativeTo: layout.relativeTo === 'safe-area' ? 'safe-area' as const : 'parent' as const,
    zIndex: numberValue(layout.zIndex, 0),
  } : { mode: 'absolute' as const, x: numberValue(layout.x, 0), y: numberValue(layout.y, 0), width: Math.max(8, numberValue(layout.width, 120)), height: Math.max(8, numberValue(layout.height, 48)), zIndex: numberValue(layout.zIndex, 0) };
  return {
    id, type: stringValue(value.type, 'missing-definition'), definitionVersion: Math.max(1, numberValue(value.definitionVersion, 1)), name: stringValue(value.name, id),
    parentId: typeof value.parentId === 'string' ? value.parentId : null,
    childIds: Array.isArray(value.childIds) ? value.childIds.filter((item): item is string => typeof item === 'string') : [],
    layout: parsedLayout,
    visible: value.visible !== false, locked: value.locked === true, opacity: Math.min(1, Math.max(0, numberValue(value.opacity, 1))), props: objectValue(value.props),
    ...(isObject(value.bindings) ? { bindings: structuredClone(value.bindings) as UiNode['bindings'] } : {}),
  };
};

const validateHierarchy = (document: UiDocument): void => {
  const roots = new Set(document.rootIds);
  if (roots.size !== document.rootIds.length) throw new Error('UI 文档包含重复根节点。');
  Object.values(document.nodes).forEach((node) => {
    if (node.parentId && !document.nodes[node.parentId]) throw new Error(`UI 节点 ${node.id} 的父节点不存在。`);
    if (!node.parentId && !roots.has(node.id)) throw new Error(`UI 根节点目录缺少 ${node.id}。`);
    if (node.parentId && roots.has(node.id)) throw new Error(`UI 节点 ${node.id} 不能同时是根节点和子节点。`);
    if (new Set(node.childIds).size !== node.childIds.length) throw new Error(`UI 节点 ${node.id} 包含重复子节点。`);
    node.childIds.forEach((childId) => { if (document.nodes[childId]?.parentId !== node.id) throw new Error(`UI 节点 ${node.id} 的子节点关系不一致：${childId}`); });
  });
  const visiting = new Set<string>(); const visited = new Set<string>();
  const visit = (id: string) => {
    if (visiting.has(id)) throw new Error(`UI 层级存在循环引用：${id}`);
    if (visited.has(id)) return;
    visiting.add(id); document.nodes[id]?.childIds.forEach(visit); visiting.delete(id); visited.add(id);
  };
  document.rootIds.forEach(visit);
  if (visited.size !== Object.keys(document.nodes).length) throw new Error('UI 文档包含无法从根节点到达的节点。');
};

export const parseUiDocument = (value: unknown, expectedKey?: string): UiDocument => {
  if (!isObject(value)) throw new Error('UI 文档必须是对象。');
  if (value.schemaVersion === 1 || Array.isArray(value.components)) return migrateLegacyUiDocument(value, expectedKey);
  if (value.schemaVersion !== 2) throw new Error(`不支持的 UI 文档版本：${String(value.schemaVersion)}`);
  const presetKey = stringValue(value.presetKey, expectedKey ?? '');
  if (!presetKey || (expectedKey && presetKey !== expectedKey)) throw new Error('UI 文档 Key 无效。');
  if (!isObject(value.nodes)) throw new Error('UI 文档 nodes 必须是对象。');
  const document: UiDocument = {
    schemaVersion: 2, presetKey, name: stringValue(value.name, presetKey), canvas: parseCanvas(value.canvas),
    rootIds: Array.isArray(value.rootIds) ? value.rootIds.filter((item): item is string => typeof item === 'string') : [],
    nodes: Object.fromEntries(Object.entries(value.nodes).map(([key, node]) => [key, parseNode(node, key)])),
    ...(isObject(value.previewContext) ? { previewContext: structuredClone(value.previewContext) } : {}),
    ...(isObject(value.metadata) ? { metadata: structuredClone(value.metadata) } : {}),
  };
  validateHierarchy(document);
  return document;
};

export const parseUiDocumentLibrary = (value: unknown): UiDocumentLibrary => {
  if (!isObject(value)) throw new Error('UI 文档库必须是对象。');
  return Object.fromEntries(Object.entries(value).map(([key, document]) => [key, parseUiDocument(document, key)]));
};
export const cloneUiDocument = (document: UiDocument): UiDocument => parseUiDocument(structuredClone(document), document.presetKey);
export const encodeUiDocumentLibrary = (library: UiDocumentLibrary): UiDocumentLibrary => Object.fromEntries(Object.entries(library).map(([key, document]) => [key, cloneUiDocument(document)]));
