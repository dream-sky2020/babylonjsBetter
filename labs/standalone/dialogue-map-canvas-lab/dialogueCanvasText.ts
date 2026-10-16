import type { CanvasTextLayout } from '../../../core/ui/canvas-text/canvasTextLayout.ts';
import { dialogueNodeTextFont, DIALOGUE_NODE_TEXT_STYLE } from '../../../core/dialogue-map/dialogueNodeLayout.ts';
import { ellipsizeCanvasText } from '../../../core/ui/canvas-text/canvasTextLayout.ts';

/** Integer device-pixel font sizes avoid fractional rasterization of tiny glyphs. */
export const getDialogueCanvasFontSize = (fontSize: number, scale: number, pixelRatio: number): number => (
  Math.max(Math.ceil(DIALOGUE_NODE_TEXT_STYLE.minimumScreenFontSize * pixelRatio), Math.floor(fontSize * scale * pixelRatio)) / pixelRatio
);
export const getDialogueCanvasTextDetail = (scale: number): 'full' | 'compact' | 'overview' => scale >= .9 ? 'full' : scale >= .45 ? 'compact' : 'overview';
export const getDialogueCanvasTextWidthInset = (scale: number, pixelRatio: number): number => (
  2 * Math.max(1 / pixelRatio, DIALOGUE_NODE_TEXT_STYLE.glyphPadding * scale) + 3 / pixelRatio
);

export const drawDialogueCanvasText = (context: CanvasRenderingContext2D, layout: CanvasTextLayout, box: {
  x: number; y: number; width: number; height: number; scale: number; color: string;
  fontSize?: number; weight?: number; center?: boolean; pixelRatio?: number;
}): void => {
  if (box.width <= 0 || box.height <= 0) return;
  context.save();
  try {
    const pixelRatio = box.pixelRatio ?? (Math.abs(context.getTransform().a) || 1);
    const snapUp = (value: number) => Math.ceil(value * pixelRatio) / pixelRatio;
    const snapDown = (value: number) => Math.floor(value * pixelRatio) / pixelRatio;
    // Keep the original region as the hard boundary. Ink is placed safely inside it.
    context.beginPath(); context.rect(box.x, box.y, box.width, box.height); context.clip();
    const fontSize = getDialogueCanvasFontSize(box.fontSize ?? DIALOGUE_NODE_TEXT_STYLE.bodySize, box.scale, pixelRatio);
    context.font = dialogueNodeTextFont(fontSize, box.weight ?? 400);
    context.fillStyle = box.color; context.textAlign = 'left'; context.textBaseline = 'alphabetic';
    const padding = Math.max(1 / pixelRatio, DIALOGUE_NODE_TEXT_STYLE.glyphPadding * box.scale);
    const left = snapUp(box.x + padding), right = snapDown(box.x + box.width - padding);
    const top = snapUp(box.y + 1 / pixelRatio), bottom = snapDown(box.y + box.height - 1 / pixelRatio);
    const width = Math.max(0, right - left - 1 / pixelRatio);
    if (!width || bottom <= top || !layout.lines.length) return;
    const inkWidth = (text: string) => {
      const metrics = context.measureText(text);
      return Math.max(metrics.width, metrics.actualBoundingBoxRight) + Math.max(0, metrics.actualBoundingBoxLeft);
    };
    const lines = layout.lines.map(line => ellipsizeCanvasText(line, width, inkWidth));
    const metrics = lines.map(line => context.measureText(line || '国Ag'));
    const ascent = Math.max(...metrics.map(item => Math.max(0, item.actualBoundingBoxAscent)));
    const descent = Math.max(...metrics.map(item => Math.max(0, item.actualBoundingBoxDescent)));
    const inkHeight = ascent + descent;
    const lineHeight = Math.min(Math.max(DIALOGUE_NODE_TEXT_STYLE.lineHeight * box.scale, inkHeight + 1 / pixelRatio), (bottom - top) / lines.length);
    if (lineHeight < inkHeight) return; // An undersized box must never show half a glyph.
    const start = top + (box.center ? Math.max(0, (bottom - top - lineHeight * lines.length) / 2) : 0);
    lines.forEach((line, index) => {
      const baseline = snapUp(start + index * lineHeight + (lineHeight - inkHeight) / 2 + ascent);
      if (baseline + descent > bottom) return;
      const x = snapUp(left + Math.max(0, metrics[index].actualBoundingBoxLeft));
      context.fillText(line, x, baseline);
    });
  } finally { context.restore(); }
};
