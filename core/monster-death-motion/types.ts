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
export type MonsterDeathDefinition = {
  id: string;
  name: string;
  description: string;
  version: number;
  parameters: MonsterDeathParameterSchema;
  sample: (context: MonsterDeathSampleContext, parameters: MonsterDeathParameterValues) => MonsterDeathSample;
};
export type MonsterDeathPreset = { presetKey: string; name: string; modeId: string; parameters: MonsterDeathParameterValues };
export type MonsterDeathPresetLibrary = Record<string, MonsterDeathPreset>;
