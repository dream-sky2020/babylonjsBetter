import type { ParticleFactoryEditableConfig } from '@/core/particle/types/particle.types.ts';

export type ParticleEditorPreset = {
  presetKey: string;
  name: string;
  visualPresetKey: string;
  capacity: number;
  isOneShot: boolean;
  autoDispose: boolean;
  minLifeTime: number;
  maxLifeTime: number;
  emitDuration: number;
  emitRate: number;
  minEmitPower: number;
  maxEmitPower: number;
  updateSpeed: number;
  gravityY: number;
  minEmitBox: { x: number; y: number; z: number };
  maxEmitBox: { x: number; y: number; z: number };
  direction1: { x: number; y: number; z: number };
  direction2: { x: number; y: number; z: number };
};

export type ParticleEditorPresetMap = Record<string, ParticleEditorPreset>;

export type ParticleVisualPreset = {
  presetKey: string;
  name: string;
  texturePath: string;
  colorMode: 'texture' | 'gradient';
  blendMode: 'alpha' | 'add' | 'multiply';
  colorGradients: Array<{ offset: number; color: { r: number; g: number; b: number; a: number } }>;
  sizeGradients: Array<{ offset: number; size: number }>;
};

export type ParticleVisualPresetMap = Record<string, ParticleVisualPreset>;

export type ParticlePresetSource = 'merged' | 'config' | 'local';

export type { ParticleFactoryEditableConfig };
