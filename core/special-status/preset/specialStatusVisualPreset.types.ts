import type { SpecialStatus3dVector } from '../types/specialStatus3d.types.ts';

export type SpecialStatusVisual2dConfig = {
  badgeSize: number;
  iconScale: number;
  valueFontSize: number;
  cornerInset: number;
  textColor: string;
  frameOffsetX: number;
  frameOffsetY: number;
  frameWidth: number;
  frameHeight: number;
};

export type SpecialStatusVisual3dConfig = {
  numberPresetKey: string;
  statusHeight: number;
  statusScale: number;
  numberScale: number;
  cornerInset: number;
  position: SpecialStatus3dVector;
  numberOffsets: [SpecialStatus3dVector, SpecialStatus3dVector, SpecialStatus3dVector, SpecialStatus3dVector];
  billboard: boolean;
};

export type SpecialStatusVisualPreset = {
  presetKey: string;
  name: string;
  ui2d: SpecialStatusVisual2dConfig;
  babylon3d: SpecialStatusVisual3dConfig;
};

export type SpecialStatusVisualPresetMap = Record<string, SpecialStatusVisualPreset>;
