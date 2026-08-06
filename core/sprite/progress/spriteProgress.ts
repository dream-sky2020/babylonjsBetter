export type ProgressShape = 'none' | 'linear' | 'radial' | 'sector' | 'ring' | 'diamond' | 'box' | 'rect-perimeter';
export type ProgressDirection = 'forward' | 'reverse' | 'center-out' | 'edges-in';
export type SpriteProgressRegionStyle = { source?: 'texture' | 'color'; color?: string; opacity?: number };
export interface SpriteProgressOptions {
  enabled?: boolean; progress?: number; value?: number; shape?: ProgressShape; direction?: ProgressDirection;
  angleDeg?: number; startAngleDeg?: number; sweepAngleDeg?: number; innerRadius?: number; outerRadius?: number;
  softness?: number; centerOffsetPx?: { x?: number; y?: number }; axisScale?: { x?: number; y?: number };
  filled?: SpriteProgressRegionStyle; unfilled?: SpriteProgressRegionStyle;
}
export const progressShapeValue = (shape?: ProgressShape): number =>
  ({ none: 0, linear: 1, radial: 2, sector: 3, ring: 4, diamond: 5, box: 6, 'rect-perimeter': 7 })[shape ?? 'none'];
export const progressDirectionValue = (direction?: ProgressDirection): number =>
  ({ forward: 1, reverse: 2, 'center-out': 3, 'edges-in': 4 })[direction ?? 'forward'];
export const resolveProgressOptions = (options: SpriteProgressOptions = {}) => ({
  shape: options.shape ?? 'none', direction: options.direction ?? 'forward', angleDeg: Number(options.angleDeg) || 0,
  progress: Number.isFinite(Number(options.progress)) ? Number(options.progress) : Number(options.value)
});
