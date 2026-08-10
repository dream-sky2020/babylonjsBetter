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
  gravity: { x: number; y: number; z: number };
  minInitialRotationDeg: number;
  maxInitialRotationDeg: number;
  minAngularSpeedDeg: number;
  maxAngularSpeedDeg: number;
  minScaleX: number;
  maxScaleX: number;
  minScaleY: number;
  maxScaleY: number;
  startDelayMs: number;
  preWarmCycles: number;
  preWarmStepOffset: number;
  forceDepthWrite: boolean;
  applyFog: boolean;
  renderingGroupId: number;
  billboardMode: 'all' | 'y' | 'stretched';
  emitterType: 'box' | 'point' | 'sphere' | 'hemisphere' | 'cylinder' | 'cone';
  emitterRadius: number;
  emitterRadiusRange: number;
  emitterHeight: number;
  emitterDirectionRandomizer: number;
  emitterAngleDeg: number;
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
  blendMode: 'alpha' | 'add' | 'multiply' | 'overwrite';
  baseSize: number;
  minSize: number;
  maxSize: number;
  baseColor: { r: number; g: number; b: number; a: number };
  colorGradientsEnabled: boolean;
  sizeGradientsEnabled: boolean;
  spriteSheet?: {
    cellWidth: number;
    cellHeight: number;
    startCellID: number;
    endCellID: number;
    randomStartCell: boolean;
    playbackMode: 'random-static' | 'loop';
    framesPerSecond: number;
  };
  colorGradients: Array<{ offset: number; color: { r: number; g: number; b: number; a: number } }>;
  sizeGradients: Array<{ offset: number; size: number }>;
};

export type ParticleVisualPresetMap = Record<string, ParticleVisualPreset>;

export type ParticlePresetSource = 'merged' | 'config' | 'local';

export type { ParticleFactoryEditableConfig };
