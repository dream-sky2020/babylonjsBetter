import { computeDialogueNodeLayout, type DialogueNodeLayout, type DialogueNodeLayoutDensity } from '../../../core/dialogue-map/dialogueNodeLayout.ts';
import type { DialogueEditorNode } from '../../../core/dialogue-map/dialogueMap.types.ts';

let context: CanvasRenderingContext2D | null = null;
const layouts: Record<DialogueNodeLayoutDensity, WeakMap<DialogueEditorNode, DialogueNodeLayout>> = {
  full: new WeakMap(), content: new WeakMap(), compact: new WeakMap(),
};
/** World-space font measurement: zoom and device pixel ratio never affect geometry. */
export const measureDialogueCanvasText = (text: string, font: string): number => {
  context ??= globalThis.document.createElement('canvas').getContext('2d');
  if (!context) throw new Error('无法初始化对话画布文字测量。');
  context.font = font;
  const metrics = context.measureText(text);
  return Math.max(metrics.width, metrics.actualBoundingBoxRight) + Math.max(0, metrics.actualBoundingBoxLeft);
};
/** Editor documents are immutable between updates, so all consumers share this plan. */
export const getDialogueCanvasLayout = (node: DialogueEditorNode, density: DialogueNodeLayoutDensity = 'full'): DialogueNodeLayout => {
  const cache = layouts[density];
  let layout = cache.get(node);
  if (!layout) { layout = computeDialogueNodeLayout(node, undefined, measureDialogueCanvasText, density); cache.set(node, layout); }
  return layout;
};
