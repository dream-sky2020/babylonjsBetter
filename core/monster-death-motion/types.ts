import type { Vector3 } from '@babylonjs/core';

export type MonsterDeathParameterDefinition =
  | { type: 'number'; label: string; default: number; min: number; max: number; step: number; group?: string }
  | { type: 'boolean'; label: string; default: boolean; group?: string }
  | { type: 'select'; label: string; default: string; options: Array<{ value: string; label: string }>; group?: string }
  | { type: 'color'; label: string; default: string; group?: string };

export type MonsterDeathParameterSchema = Record<string, MonsterDeathParameterDefinition>;
export type MonsterDeathParameterValues = Record<string, number | boolean | string>;
export type MonsterDeathLayerSample = { opacity: number; offsetX: number; offsetY: number };
export type MonsterDeathSample = {
  visualOffset: Vector3;
  rotationX: number;
  rotationY: number;
  rotationZ: number;
  scaleX: number;
  scaleY: number;
  scaleZ: number;
  opacity: number;
  overlayColor: string;
  overlayStrength: number;
  layers?: MonsterDeathLayerSample[];
};
export type MonsterDeathSampleContext = { progress: number };
export type MonsterDeathVisualDefinition = {
  spriteEffect?: {
    /** Monster 已常驻此 Recipe；这里只声明需要驱动的能力，不触发切换。 */
    recipeId: 'striped-sprite';
    pattern: 'ash' | 'frost' | 'void';
  };
  particles?: {
    presetKey: 'ash' | 'blackShards' | 'embers' | 'pixel';
    startProgress?: number;
    endProgress?: number;
  };
};
export type MonsterDeathDefinition = {
  id: string;
  name: string;
  description: string;
  version: number;
  parameters: MonsterDeathParameterSchema;
  visual?: MonsterDeathVisualDefinition;
  sample: (context: MonsterDeathSampleContext, parameters: MonsterDeathParameterValues) => MonsterDeathSample;
};
export type MonsterDeathPreset = { presetKey: string; name: string; modeId: string; parameters: MonsterDeathParameterValues };
export type MonsterDeathPresetLibrary = Record<string, MonsterDeathPreset>;
