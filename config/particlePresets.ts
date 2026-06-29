import type { ParticleEditorPresetMap } from '@app-types/particle-editor.types';

export const particlePresets: ParticleEditorPresetMap = {
  spark: {
    presetKey: 'spark',
    name: 'Spark',
    texturePath: 'particle_white.svg',
    capacity: 120,
    isOneShot: true,
    autoDispose: true,
    minLifeTime: 0.35,
    maxLifeTime: 1.2,
    emitDuration: 0.18,
    emitRate: 60,
    minEmitPower: 2,
    maxEmitPower: 5,
    updateSpeed: 0.01,
    gravityY: -9.81,
    minEmitBox: { x: -0.2, y: 0, z: -0.2 },
    maxEmitBox: { x: 0.2, y: 0, z: 0.2 },
    direction1: { x: -2, y: 2, z: -2 },
    direction2: { x: 2, y: 5, z: 2 },
    colorGradients: [
      { offset: 0, color: { r: 1, g: 0.95, b: 0.55, a: 1 } },
      { offset: 0.6, color: { r: 1, g: 0.45, b: 0.2, a: 0.65 } },
      { offset: 1, color: { r: 1, g: 0.25, b: 0.1, a: 0 } }
    ],
    sizeGradients: [
      { offset: 0, size: 0.22 },
      { offset: 0.5, size: 0.16 },
      { offset: 1, size: 0.05 }
    ]
  },
  halo: {
    presetKey: 'halo',
    name: 'Halo',
    texturePath: 'particle_white.svg',
    capacity: 140,
    isOneShot: true,
    autoDispose: true,
    minLifeTime: 0.7,
    maxLifeTime: 2.2,
    emitDuration: 0.3,
    emitRate: 45,
    minEmitPower: 0.5,
    maxEmitPower: 1.8,
    updateSpeed: 0.008,
    gravityY: 0,
    minEmitBox: { x: -0.12, y: 0, z: -0.12 },
    maxEmitBox: { x: 0.12, y: 0, z: 0.12 },
    direction1: { x: -0.4, y: 0.8, z: -0.4 },
    direction2: { x: 0.4, y: 1.2, z: 0.4 },
    colorGradients: [
      { offset: 0, color: { r: 0.55, g: 0.85, b: 1, a: 0.75 } },
      { offset: 0.4, color: { r: 0.4, g: 0.75, b: 1, a: 0.45 } },
      { offset: 1, color: { r: 0.2, g: 0.55, b: 1, a: 0 } }
    ],
    sizeGradients: [
      { offset: 0, size: 0.08 },
      { offset: 0.6, size: 0.35 },
      { offset: 1, size: 0.62 }
    ]
  }
};
