import { DIALOGUE_MAP_GRID_SIZE, DIALOGUE_NODE_WHITESPACE_DEFAULTS, type DialogueEditorNode } from './dialogueMap.types.ts';
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
  whitespaceRegions: DialogueGridRect[];
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

/** Synthetic summaries are display-only and never saved as dialogue lines. */
export const getDialogueNodeDisplayLines = (node: DialogueEditorNode) => {
  if (node.kind === 'choice') return node.lines;
  if (node.kind === 'condition') {
    const condition = node.condition;
    if (!condition) return new Map([[`summary:${node.id}`, { id: `summary:${node.id}`, speaker: '判断条件', text: '未设置判断条件' }]]);
    const comparisons = condition.type === 'compare' ? [condition] : condition.conditions;
    const mode = condition.type === 'any' ? '任一满足' : '全部满足';
    return new Map([
      [`summary:${node.id}`, { id: `summary:${node.id}`, speaker: '判断条件', text: mode }],
      ...comparisons.map((item, index) => { const id = `condition:${node.id}:${index}`; return [id, { id, speaker: `条件 ${index + 1}`, text: summarizeDialogueCondition(item) }] as const; }),
    ]);
  }
  return new Map([
    [`summary:${node.id}`, { id: `summary:${node.id}`, speaker: '事件模式', text: node.mode === 'wait' ? '等待一个事件' : `依次触发 ${node.events.length} 个事件` }],
    ...node.events.map((event, index) => {
      const id = `event:${node.id}:${index}`;
      const text = `${event.eventType || '未设置事件'} @${event.version}\n${Object.entries(event.payload ?? {}).map(([key, value]) => `${key}: ${value.type === 'memory' ? value.key + '.' + value.path.join('.') : JSON.stringify(value.value)}`).join(' · ')}`;
      return [id, { id, speaker: `事件 ${index + 1}`, text }] as const;
    }),
  ]);
};

export const computeDialogueNodeLayout = (node: DialogueEditorNode, metrics: Readonly<DialogueNodeLayoutMetrics> = DIALOGUE_NODE_LAYOUT_METRICS, measureText?: DialogueNodeTextMeasure): DialogueNodeLayout => {
  const whitespace = { ...DIALOGUE_NODE_WHITESPACE_DEFAULTS, ...node.display.whitespace };
  metrics = { ...metrics,
    headerUnits: whitespace.header ? metrics.headerUnits : 1,
    topPaddingUnits: whitespace.top ? metrics.topPaddingUnits : 0,
    lineUnits: whitespace.content ? metrics.lineUnits : 1,
    sectionGapUnits: whitespace.sections ? metrics.sectionGapUnits : 0,
    outputUnits: whitespace.outputs ? metrics.outputUnits : 1,
    bottomPaddingUnits: whitespace.bottom ? metrics.bottomPaddingUnits : 0,
  };
  const whitespaceRegions: DialogueGridRect[] = [];
  const widthUnits = Math.max(4, Math.floor(node.display.widthUnits));
  const requestedHeightUnits = Math.max(3, Math.floor(node.display.heightUnits));
  const inset = Math.min(contentInsetForShape(node), Math.max(1, Math.floor((widthUnits - 1) / 2)));
  const rowWidth = Math.max(0, widthUnits - inset * 2);
  const lineRows = new Map<string, DialogueNodeRowLayout>(); const inputRows = new Map<string, DialogueNodeRowLayout>(); const outputRows = new Map<string, DialogueNodeRowLayout>();
  const inputAnchors = new Map<string, DialogueGridPoint>(); const outputAnchors = new Map<string, DialogueGridPoint>(); const separators: number[] = [metrics.headerUnits];
  let cursor = metrics.headerUnits + metrics.topPaddingUnits;
  const measuredRow = (id: string, minimumUnits: number, specs: Array<{ role: DialogueNodeTextBlock['role']; text: string; maxLines: number; wrap?: boolean }>): DialogueNodeRowLayout => {
    if (!measureText) return row(id, inset, cursor, rowWidth, minimumUnits);
    const spacious = specs.some(spec => spec.role === 'label') ? whitespace.outputs : whitespace.content;
    const textPadding = spacious ? DIALOGUE_NODE_TEXT_STYLE.padding : 3;
    const blockGap = spacious ? DIALOGUE_NODE_TEXT_STYLE.blockGap : 2;
    let offsetY = textPadding;
    const textBlocks = specs.map(spec => {
      const block = { ...layoutCanvasText(spec.text, {
        maxWidth: Math.max(0, rowWidth * DIALOGUE_MAP_GRID_SIZE - DIALOGUE_NODE_TEXT_STYLE.glyphPadding * 2 - DIALOGUE_NODE_TEXT_STYLE.pixelAlignmentPadding), maxLines: spec.maxLines,
        wrap: spec.wrap, measure: text => measureText(text, dialogueNodeTextFont()),
      }), role: spec.role, offsetY };
      offsetY += block.lines.length * DIALOGUE_NODE_TEXT_STYLE.lineHeight + blockGap;
      return block;
    });
    const pixels = offsetY - (specs.length ? blockGap : 0) + textPadding;
    return { ...row(id, inset, cursor, rowWidth, Math.max(minimumUnits, Math.ceil(pixels / DIALOGUE_MAP_GRID_SIZE))), textBlocks };
  };

  if (!node.display.collapsed) {
    const displayLines = getDialogueNodeDisplayLines(node);
    [...displayLines.keys()].forEach((id) => {
      const line = displayLines.get(id);
      const value = measuredRow(id, metrics.lineUnits, [
        ...(node.display.showSpeakerList === false ? [] : [{ role: 'speaker' as const, text: line?.speaker || '无说话者', maxLines: 1, wrap: false }]),
        ...(node.display.showPreviewText === false ? [] : [{ role: 'body' as const, text: line?.text || '（空对白）', maxLines: DIALOGUE_NODE_TEXT_STYLE.dialogueMaxLines }]),
      ]);
      lineRows.set(id, value); cursor += value.rect.height; separators.push(cursor);
    });
    if (displayLines.size && node.outputOrder.length) { cursor += metrics.sectionGapUnits; separators.push(cursor); }
    node.outputOrder.forEach((id) => {
      const output = node.outputs.get(id);
      const icon = output?.branch === 'true' ? '✓' : output?.branch === 'false' ? '✕' : '›';
      const value = measuredRow(id, metrics.outputUnits, [
        { role: 'label', text: `${icon} ${output?.label || id}`, maxLines: 1, wrap: false },
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
  const actualHeightUnits = whitespace.height ? Math.max(requestedHeightUnits, minimumHeightUnits) : minimumHeightUnits;
  const band = (y: number, height: number, x = 0, width = widthUnits) => { if (height > 0) whitespaceRegions.push({ x, y, width, height }); };
  const headerPadding = Math.max(0, (metrics.headerUnits - DIALOGUE_NODE_TEXT_STYLE.lineHeight / DIALOGUE_MAP_GRID_SIZE) / 2);
  band(0, headerPadding); band(metrics.headerUnits - headerPadding, headerPadding);
  band(metrics.headerUnits, metrics.topPaddingUnits);
  for (const value of [...lineRows.values(), ...outputRows.values()]) {
    let end = value.rect.y;
    for (const block of value.textBlocks ?? []) {
      const start = value.rect.y + block.offsetY / DIALOGUE_MAP_GRID_SIZE;
      band(end, start - end, value.rect.x, value.rect.width);
      end = start + block.lines.length * DIALOGUE_NODE_TEXT_STYLE.lineHeight / DIALOGUE_MAP_GRID_SIZE;
    }
    if (value.textBlocks) band(end, value.rect.y + value.rect.height - end, value.rect.x, value.rect.width);
  }
  if (!node.display.collapsed && lineRows.size && outputRows.size) {
    const last = [...lineRows.values()].at(-1)!;
    band(last.rect.y + last.rect.height, metrics.sectionGapUnits);
  }
  band(cursor, actualHeightUnits - cursor);
  return {
    whitespaceRegions,
    widthUnits, requestedHeightUnits, minimumHeightUnits, actualHeightUnits, contentInsetUnits: inset,
    header: { x: 0, y: 0, width: widthUnits, height: metrics.headerUnits },
    content: { x: inset, y: metrics.headerUnits, width: rowWidth, height: actualHeightUnits - metrics.headerUnits },
    lineRows, inputRows, outputRows, inputAnchors, outputAnchors, separators: [...new Set(separators)].sort((a, b) => a - b),
  };
};

export const dialogueGridRectContains = (rect: DialogueGridRect, point: DialogueGridPoint): boolean => point.x >= rect.x && point.x <= rect.x + rect.width && point.y >= rect.y && point.y <= rect.y + rect.height;
export const dialogueLayoutPointToWorld = (node: DialogueEditorNode, point: DialogueGridPoint): DialogueGridPoint => ({ x: node.position.x + point.x * DIALOGUE_MAP_GRID_SIZE, y: node.position.y + point.y * DIALOGUE_MAP_GRID_SIZE });
export const dialogueLayoutRectToWorld = (node: DialogueEditorNode, rect: DialogueGridRect): DialogueGridRect => ({ x: node.position.x + rect.x * DIALOGUE_MAP_GRID_SIZE, y: node.position.y + rect.y * DIALOGUE_MAP_GRID_SIZE, width: rect.width * DIALOGUE_MAP_GRID_SIZE, height: rect.height * DIALOGUE_MAP_GRID_SIZE });
