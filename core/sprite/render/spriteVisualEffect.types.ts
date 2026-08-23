import type { Color3 } from '@babylonjs/core';
import type { SpriteDissolveEffectState } from '../dissolve/spriteDissolve.types.ts';

export type StripeSegmentLike = {
  width?: number;
  fillType?: 'solid' | 'gradient';
  color?: string;
  fromColor?: string;
  toColor?: string;
  opacity?: number;
};

export type StripePresetLike = {
  mode?: 'texture' | 'solid' | 'stripes';
  solidColor?: string;
  solidOpacity?: number;
  angleDeg?: number;
  speed?: number;
  background?: string;
  backgroundOpacity?: number;
  segments?: StripeSegmentLike[];
};

export type StripeProgressShape = 'none' | 'linear' | 'radial' | 'sector' | 'ring' | 'diamond' | 'box' | 'rect-perimeter';
export type StripeProgressDirection = 'forward' | 'reverse' | 'center-out' | 'edges-in';

export type StripeProgressRegionStyle = {
  source?: 'texture' | 'color';
  color?: string;
  opacity?: number;
};

export type StripeProgressMaskOptions = {
  enabled?: boolean;
  value?: number;
  progress?: number;
  shape?: StripeProgressShape;
  direction?: StripeProgressDirection;
  angleDeg?: number;
  startAngleDeg?: number;
  sweepAngleDeg?: number;
  innerRadius?: number;
  outerRadius?: number;
  softness?: number;
  centerOffsetPx?: { x?: number; y?: number };
  axisScale?: { x?: number; y?: number };
  filled?: StripeProgressRegionStyle;
  unfilled?: StripeProgressRegionStyle;
};

export type StripeLayerProgressOptions = {
  enabled?: boolean;
  stripe?: StripeProgressMaskOptions;
  background?: StripeProgressMaskOptions;
};

export type SpriteColorOverlayState = {
  color: Color3;
  alpha: number;
};

/** 所有平面精灵共享的、与具体 Shader 实现无关的视觉状态。 */
export type SpriteVisualEffectState = {
  stripe?: StripePresetLike;
  progressMask?: StripeProgressMaskOptions;
  layerProgressMask?: StripeLayerProgressOptions;
  dissolve?: SpriteDissolveEffectState;
  colorOverlay?: SpriteColorOverlayState;
};
