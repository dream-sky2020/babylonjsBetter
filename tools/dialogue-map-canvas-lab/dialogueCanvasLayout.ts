import { computeDialogueNodeLayout, type DialogueNodeLayout } from '../../core/dialogue-map/dialogueNodeLayout.ts';
import type { DialogueEditorNode } from '../../core/dialogue-map/dialogueMap.types.ts';

let context: CanvasRenderingContext2D | null = null;
const layouts = new WeakMap<DialogueEditorNode, DialogueNodeLayout>();
/** World-space font measurement: zoom and device pixel ratio never affect geometry. */
export const measureDialogueCanvasText = (text: string, font: string): number => {
  context ??= globalThis.document.createElement('canvas').getContext('2d');
  if (!context) throw new Error('无法初始化对话画布文字测量。');
  context.font = font;
  const metrics = context.measureText(text);
  return Math.max(metrics.width, metrics.actualBoundingBoxRight) + Math.max(0, metrics.actualBoundingBoxLeft);
};
/** Editor documents are immutable between updates, so all consumers share this plan. */
export const getDialogueCanvasLayout = (node: DialogueEditorNode): DialogueNodeLayout => {
  let layout = layouts.get(node);
  if (!layout) { layout = computeDialogueNodeLayout(node, undefined, measureDialogueCanvasText); layouts.set(node, layout); }
  return layout;
};
