/**
 * Particle feature 唯一导出入口。
 * 业务层请统一：import { ... } from '@/core/particle'
 */

// types
export type {
  ColorGradient,
  SizeGradient,
  ParticleEffectConfig,
  ParticleController,
  ParticleFactoryEditableConfig
} from '@/core/particle/types/particle.types.ts';
export type {
  ParticleEditorPreset,
  ParticleEditorPresetMap,
  ParticlePresetSource
} from '@/core/particle/types/particle-preset.types.ts';

// entity
export {
  createBurstParticleEffect,
  playBurstOneShot
} from '@/core/particle/entity/createBurstParticleEffect.ts';

// constants
export {
  ORTHO_HALF_HEIGHT,
  DEFAULT_3D_CAMERA_ALPHA,
  DEFAULT_3D_CAMERA_BETA,
  DEFAULT_3D_CAMERA_RADIUS,
  INPUT_STEP,
  DEFAULT_PARTICLE_PRESET_KEY
} from '@/core/particle/constants/particle.constants.ts';

// editor helpers
export {
  normalizePublicPath,
  getLastParticlePresetKey,
  saveLastParticlePresetKey,
  getLastViewMode,
  saveLastViewMode,
  createGradientNodeId
} from '@/core/particle/editor/particleEditorHelpers.ts';

// preset api
export { fetchParticlePresetServerConnection } from '@/core/particle/preset/particlePresetApi.ts';

// preset repository
export {
  hydrateParticlePresetStorage,
  reloadParticlePresetStorage,
  getAllParticlePresets,
  getLocalParticlePreset,
  hasLocalParticlePreset,
  saveParticlePreset,
  removeParticlePreset,
  getParticlePreset
} from '@/core/particle/preset/particlePresetRepository.ts';
