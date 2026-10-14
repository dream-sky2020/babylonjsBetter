import { DIALOGUE_MAP_GRID_SIZE, type DialogueEditorNode } from './dialogueMap.types.ts';
import { layoutCanvasText, type CanvasTextLayout } from '../ui/canvas-text/canvasTextLayout.ts';
import { summarizeDialogueCondition } from './dialogueRules.ts';

export type DialogueGridPoint = { x: number; y: number };
export type DialogueGridRect = DialogueGridPoint & { width: number; height: number };
export type DialogueNodeTextBlock = CanvasTextLayout & { role: 'speaker' | 'body' | 'label' | 'detail'; offsetY: number };
export type DialogueNodeRowLayout = { id: string; rect: DialogueGridRect; centerY: number; textBlocks?: DialogueNodeTextBlock[] };
export type DialogueNodeTextMeasure = (text: string, font: string) => number;
export const DIALOGUE_NODE_TEXT_STYLE = Object.freeze({
  family: '"Segoe UI", "Microsoft YaHei", sans-serif', titleSize: 14, bodySize: 12,
  lineHeight: 18, padding: 8, blockGap: 4, dialogueMaxLines: 3, detailMaxLines: 2,
  minimumScreenFontSize: 10, glyphPadding: 2, pixelAlignmentPadding: 4,
});
export const dialogueNodeTextFont = (size: number = DIALOGUE_NODE_TEXT_STYLE.bodySize, weight = 400): string => `${weight} ${size}px ${DIALOGUE_NODE_TEXT_STYLE.family}`;
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

export const computeDialogueNodeLayout = (node: DialogueEditorNode, metrics: Readonly<DialogueNodeLayoutMetrics> = DIALOGUE_NODE_LAYOUT_METRICS, measureText?: DialogueNodeTextMeasure): DialogueNodeLayout => {
  const widthUnits = Math.max(4, Math.floor(node.display.widthUnits));
  const requestedHeightUnits = Math.max(3, Math.floor(node.display.heightUnits));
  const inset = Math.min(contentInsetForShape(node), Math.max(1, Math.floor((widthUnits - 1) / 2)));
  const rowWidth = Math.max(0, widthUnits - inset * 2);
  const lineRows = new Map<string, DialogueNodeRowLayout>(); const inputRows = new Map<string, DialogueNodeRowLayout>(); const outputRows = new Map<string, DialogueNodeRowLayout>();
  const inputAnchors = new Map<string, DialogueGridPoint>(); const outputAnchors = new Map<string, DialogueGridPoint>(); const separators: number[] = [metrics.headerUnits];
  let cursor = metrics.headerUnits + metrics.topPaddingUnits;
  const measuredRow = (id: string, minimumUnits: number, specs: Array<{ role: DialogueNodeTextBlock['role']; text: string; maxLines: number; wrap?: boolean }>): DialogueNodeRowLayout => {
    if (!measureText) return row(id, inset, cursor, rowWidth, minimumUnits);
    let offsetY = DIALOGUE_NODE_TEXT_STYLE.padding;
    const textBlocks = specs.map(spec => {
      const block = { ...layoutCanvasText(spec.text, {
        maxWidth: Math.max(0, rowWidth * DIALOGUE_MAP_GRID_SIZE - DIALOGUE_NODE_TEXT_STYLE.glyphPadding * 2 - DIALOGUE_NODE_TEXT_STYLE.pixelAlignmentPadding), maxLines: spec.maxLines,
        wrap: spec.wrap, measure: text => measureText(text, dialogueNodeTextFont()),
      }), role: spec.role, offsetY };
      offsetY += block.lines.length * DIALOGUE_NODE_TEXT_STYLE.lineHeight + DIALOGUE_NODE_TEXT_STYLE.blockGap;
      return block;
    });
    const pixels = offsetY - (specs.length ? DIALOGUE_NODE_TEXT_STYLE.blockGap : 0) + DIALOGUE_NODE_TEXT_STYLE.padding;
    return { ...row(id, inset, cursor, rowWidth, Math.max(minimumUnits, Math.ceil(pixels / DIALOGUE_MAP_GRID_SIZE))), textBlocks };
  };

  if (!node.display.collapsed) {
    node.lineOrder.forEach((id) => {
      const line = node.lines.get(id);
      const value = measuredRow(id, metrics.lineUnits, [
        ...(node.display.showSpeakerList === false ? [] : [{ role: 'speaker' as const, text: line?.speaker || '无说话者', maxLines: 1, wrap: false }]),
        ...(node.display.showPreviewText === false ? [] : [{ role: 'body' as const, text: line?.text || '（空对白）', maxLines: DIALOGUE_NODE_TEXT_STYLE.dialogueMaxLines }]),
      ]);
      lineRows.set(id, value); cursor += value.rect.height; separators.push(cursor);
    });
    if (node.lineOrder.length && node.outputOrder.length) { cursor += metrics.sectionGapUnits; separators.push(cursor); }
    node.outputOrder.forEach((id) => {
      const output = node.outputs.get(id);
      const icon = output?.activation.type === 'auto' ? '↪' : output?.activation.type === 'event' ? '⚡' : '›';
      const activation = output?.activation.type === 'auto' ? `自动 · 优先级 ${output.activation.priority ?? 0}`
        : output?.activation.type === 'event' ? `事件 · ${output.activation.eventType || '未设置'} @${output.activation.version}` : '玩家选择';
      const detail = `${activation} · ${summarizeDialogueCondition(output?.condition)}${output?.effects?.length ? ` · ${output.effects.length} 个事件` : ''}`;
      const value = measuredRow(id, metrics.outputUnits, [
        { role: 'label', text: `${icon} ${output?.label || id}`, maxLines: 1, wrap: false },
        { role: 'detail', text: detail, maxLines: DIALOGUE_NODE_TEXT_STYLE.detailMaxLines },
      ]);
      outputRows.set(id, value); outputAnchors.set(id, { x: widthUnits, y: value.centerY }); cursor += value.rect.height; separators.push(cursor);
    });
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
