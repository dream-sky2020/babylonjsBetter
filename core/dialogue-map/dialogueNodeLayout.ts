import { DIALOGUE_MAP_GRID_SIZE, type DialogueEditorNode } from './dialogueMap.types.ts';

export type DialogueGridPoint = { x: number; y: number };
export type DialogueGridRect = DialogueGridPoint & { width: number; height: number };
export type DialogueNodeRowLayout = { id: string; rect: DialogueGridRect; centerY: number };
export type DialogueNodeLayoutMetrics = {
  headerUnits: number;
  topPaddingUnits: number;
  lineUnits: number;
  sectionGapUnits: number;
  outputUnits: number;
  bottomPaddingUnits: number;
  inputSlotUnits: number;
  portRadiusUnits: number;
};
export type DialogueNodeLayout = {
  widthUnits: number;
  requestedHeightUnits: number;
  minimumHeightUnits: number;
  actualHeightUnits: number;
  contentInsetUnits: number;
  header: DialogueGridRect;
  content: DialogueGridRect;
  lineRows: Map<string, DialogueNodeRowLayout>;
  inputRows: Map<string, DialogueNodeRowLayout>;
  outputRows: Map<string, DialogueNodeRowLayout>;
  inputAnchors: Map<string, DialogueGridPoint>;
  outputAnchors: Map<string, DialogueGridPoint>;
  separators: number[];
};

export const DIALOGUE_NODE_LAYOUT_METRICS: Readonly<DialogueNodeLayoutMetrics> = Object.freeze({
  headerUnits: 2,
  topPaddingUnits: 1,
  lineUnits: 2,
  sectionGapUnits: 1,
  outputUnits: 2,
  bottomPaddingUnits: 1,
  inputSlotUnits: 1,
  portRadiusUnits: .25,
});

const contentInsetForShape = (node: DialogueEditorNode): number => node.display.shape === 'diamond' || node.display.shape === 'hexagon' || node.display.shape === 'pill' ? 2 : 1;
const row = (id: string, x: number, y: number, width: number, height: number): DialogueNodeRowLayout => ({ id, rect: { x, y, width, height }, centerY: y + height / 2 });

export const computeDialogueNodeLayout = (node: DialogueEditorNode, metrics: Readonly<DialogueNodeLayoutMetrics> = DIALOGUE_NODE_LAYOUT_METRICS): DialogueNodeLayout => {
  const widthUnits = Math.max(4, Math.floor(node.display.widthUnits));
  const requestedHeightUnits = Math.max(3, Math.floor(node.display.heightUnits));
  const inset = Math.min(contentInsetForShape(node), Math.max(1, Math.floor((widthUnits - 1) / 2)));
  const rowWidth = Math.max(0, widthUnits - inset * 2);
  const lineRows = new Map<string, DialogueNodeRowLayout>(); const inputRows = new Map<string, DialogueNodeRowLayout>(); const outputRows = new Map<string, DialogueNodeRowLayout>();
  const inputAnchors = new Map<string, DialogueGridPoint>(); const outputAnchors = new Map<string, DialogueGridPoint>(); const separators: number[] = [metrics.headerUnits];
  let cursor = metrics.headerUnits + metrics.topPaddingUnits;

  if (!node.display.collapsed) {
    node.lineOrder.forEach((id) => { const value = row(id, inset, cursor, rowWidth, metrics.lineUnits); lineRows.set(id, value); cursor += metrics.lineUnits; separators.push(cursor); });
    if (node.lineOrder.length && node.outputOrder.length) { cursor += metrics.sectionGapUnits; separators.push(cursor); }
    node.outputOrder.forEach((id) => { const value = row(id, inset, cursor, rowWidth, metrics.outputUnits); outputRows.set(id, value); outputAnchors.set(id, { x: widthUnits, y: value.centerY }); cursor += metrics.outputUnits; separators.push(cursor); });
  } else {
    const slotStart = metrics.headerUnits;
    node.outputOrder.forEach((id, index) => { const value = row(id, inset, slotStart + index * metrics.inputSlotUnits, rowWidth, metrics.inputSlotUnits); outputRows.set(id, value); outputAnchors.set(id, { x: widthUnits, y: value.centerY }); });
    cursor = Math.max(cursor, slotStart + node.outputOrder.length * metrics.inputSlotUnits);
  }

  const inputStart = metrics.headerUnits;
  node.inputOrder.forEach((id, index) => { const value = row(id, inset, inputStart + index * metrics.inputSlotUnits, rowWidth, metrics.inputSlotUnits); inputRows.set(id, value); inputAnchors.set(id, { x: 0, y: value.centerY }); });
  const contentMinimum = cursor + metrics.bottomPaddingUnits;
  const inputMinimum = inputStart + node.inputOrder.length * metrics.inputSlotUnits + metrics.bottomPaddingUnits;
  const minimumHeightUnits = Math.max(3, contentMinimum, inputMinimum);
  const actualHeightUnits = Math.max(requestedHeightUnits, minimumHeightUnits);
  return {
    widthUnits, requestedHeightUnits, minimumHeightUnits, actualHeightUnits, contentInsetUnits: inset,
    header: { x: 0, y: 0, width: widthUnits, height: metrics.headerUnits },
    content: { x: inset, y: metrics.headerUnits, width: rowWidth, height: actualHeightUnits - metrics.headerUnits },
    lineRows, inputRows, outputRows, inputAnchors, outputAnchors, separators: [...new Set(separators)].sort((a, b) => a - b),
  };
};

export const dialogueGridRectContains = (rect: DialogueGridRect, point: DialogueGridPoint): boolean => point.x >= rect.x && point.x <= rect.x + rect.width && point.y >= rect.y && point.y <= rect.y + rect.height;
export const dialogueLayoutPointToWorld = (node: DialogueEditorNode, point: DialogueGridPoint): DialogueGridPoint => ({ x: node.position.x + point.x * DIALOGUE_MAP_GRID_SIZE, y: node.position.y + point.y * DIALOGUE_MAP_GRID_SIZE });
export const dialogueLayoutRectToWorld = (node: DialogueEditorNode, rect: DialogueGridRect): DialogueGridRect => ({ x: node.position.x + rect.x * DIALOGUE_MAP_GRID_SIZE, y: node.position.y + rect.y * DIALOGUE_MAP_GRID_SIZE, width: rect.width * DIALOGUE_MAP_GRID_SIZE, height: rect.height * DIALOGUE_MAP_GRID_SIZE });
