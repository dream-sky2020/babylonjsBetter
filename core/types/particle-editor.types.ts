import type { ParticleEffectConfig } from '../core/adapters/particleFactory';

export type ParticleEditorPreset = {
  presetKey: string;
  name: string;
  texturePath: string;
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
  colorGradients: Array<{ offset: number; color: { r: number; g: number; b: number; a: number } }>;
  sizeGradients: Array<{ offset: number; size: number }>;
};

export type ParticleEditorPresetMap = Record<string, ParticleEditorPreset>;

export type ParticlePresetSource = 'merged' | 'config' | 'local';

export type ParticleFactoryEditableConfig = Omit<ParticleEffectConfig, 'emitter'>;
