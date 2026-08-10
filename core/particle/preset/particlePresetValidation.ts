import type {
  ParticleEditorPreset,
  ParticleEditorPresetMap
} from '@/core/particle/types/particle-preset.types.ts';
import { DEFAULT_PARTICLE_PRESET_KEY } from '@/core/particle/constants/particle.constants.ts';

const isObject = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null;
};

const toFinite = (value: unknown, fallback: number): number => {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
};

const sanitizeVec3 = (
  input: Partial<{ x: number; y: number; z: number }> | undefined,
  fallback: { x: number; y: number; z: number }
): { x: number; y: number; z: number } => ({
  x: toFinite(input?.x, fallback.x),
  y: toFinite(input?.y, fallback.y),
  z: toFinite(input?.z, fallback.z)
});

export const sanitizePreset = (raw: ParticleEditorPreset, keyFallback?: string): ParticleEditorPreset => {
  const presetKey = String(raw.presetKey || keyFallback || 'unnamed');
  const legacy = raw as ParticleEditorPreset & { gravityY?: number };
  const emitterType = ['box', 'point', 'sphere', 'hemisphere', 'cylinder', 'cone'].includes(raw.emitterType)
    ? raw.emitterType
    : 'box';
  const billboardMode = raw.billboardMode === 'y' || raw.billboardMode === 'stretched'
    ? raw.billboardMode
    : 'all';
  return {
    presetKey,
    name: String(raw.name || presetKey),
    visualPresetKey: String(raw.visualPresetKey || `${presetKey}-visual`),
    capacity: Math.max(1, Math.round(toFinite(raw.capacity, 100))),
    isOneShot: Boolean(raw.isOneShot),
    autoDispose: Boolean(raw.autoDispose),
    minLifeTime: Math.max(0.01, toFinite(raw.minLifeTime, 0.3)),
    maxLifeTime: Math.max(Math.max(0.01, toFinite(raw.minLifeTime, 0.3)), toFinite(raw.maxLifeTime, 0.8)),
    emitDuration: Math.max(0.01, toFinite(raw.emitDuration, 0.12)),
    emitRate: Math.max(1, toFinite(raw.emitRate, 50)),
    minEmitPower: Math.max(0.01, toFinite(raw.minEmitPower, 2)),
    maxEmitPower: Math.max(Math.max(0.01, toFinite(raw.minEmitPower, 2)), toFinite(raw.maxEmitPower, 5)),
    updateSpeed: Math.max(0.0001, toFinite(raw.updateSpeed, 0.01)),
    gravity: sanitizeVec3(raw.gravity, { x: 0, y: toFinite(legacy.gravityY, -9.81), z: 0 }),
    minInitialRotationDeg: toFinite(raw.minInitialRotationDeg, 0),
    maxInitialRotationDeg: Math.max(toFinite(raw.minInitialRotationDeg, 0), toFinite(raw.maxInitialRotationDeg, 0)),
    minAngularSpeedDeg: toFinite(raw.minAngularSpeedDeg, 0),
    maxAngularSpeedDeg: Math.max(toFinite(raw.minAngularSpeedDeg, 0), toFinite(raw.maxAngularSpeedDeg, 0)),
    minScaleX: Math.max(0.0001, toFinite(raw.minScaleX, 1)),
    maxScaleX: Math.max(Math.max(0.0001, toFinite(raw.minScaleX, 1)), toFinite(raw.maxScaleX, 1)),
    minScaleY: Math.max(0.0001, toFinite(raw.minScaleY, 1)),
    maxScaleY: Math.max(Math.max(0.0001, toFinite(raw.minScaleY, 1)), toFinite(raw.maxScaleY, 1)),
    startDelayMs: Math.max(0, Math.round(toFinite(raw.startDelayMs, 0))),
    preWarmCycles: Math.max(0, Math.round(toFinite(raw.preWarmCycles, 0))),
    preWarmStepOffset: Math.max(0, toFinite(raw.preWarmStepOffset, 1)),
    forceDepthWrite: Boolean(raw.forceDepthWrite),
    applyFog: Boolean(raw.applyFog),
    renderingGroupId: Math.max(0, Math.min(3, Math.round(toFinite(raw.renderingGroupId, 0)))),
    billboardMode,
    emitterType: emitterType as ParticleEditorPreset['emitterType'],
    emitterRadius: Math.max(0.0001, toFinite(raw.emitterRadius, 1)),
    emitterRadiusRange: Math.max(0, Math.min(1, toFinite(raw.emitterRadiusRange, 1))),
    emitterHeight: Math.max(0.0001, toFinite(raw.emitterHeight, 1)),
    emitterDirectionRandomizer: Math.max(0, Math.min(1, toFinite(raw.emitterDirectionRandomizer, 0))),
    emitterAngleDeg: Math.max(0.1, Math.min(179, toFinite(raw.emitterAngleDeg, 45))),
    minEmitBox: sanitizeVec3(raw.minEmitBox, { x: -0.2, y: 0, z: -0.2 }),
    maxEmitBox: sanitizeVec3(raw.maxEmitBox, { x: 0.2, y: 0, z: 0.2 }),
    direction1: sanitizeVec3(raw.direction1, { x: -2, y: 2, z: -2 }),
    direction2: sanitizeVec3(raw.direction2, { x: 2, y: 5, z: 2 })
  };
};

export const createDefaultParticlePreset = (
  presetKey = DEFAULT_PARTICLE_PRESET_KEY
): ParticleEditorPreset => {
  return sanitizePreset({
    presetKey,
    name: presetKey === DEFAULT_PARTICLE_PRESET_KEY ? 'Spark' : presetKey,
    visualPresetKey: `${presetKey}-visual`,
    capacity: 100,
    isOneShot: true,
    autoDispose: true,
    minLifeTime: 0.3,
    maxLifeTime: 0.8,
    emitDuration: 0.12,
    emitRate: 50,
    minEmitPower: 2,
    maxEmitPower: 5,
    updateSpeed: 0.01,
    gravity: { x: 0, y: -9.81, z: 0 },
    minInitialRotationDeg: 0,
    maxInitialRotationDeg: 0,
    minAngularSpeedDeg: 0,
    maxAngularSpeedDeg: 0,
    minScaleX: 1,
    maxScaleX: 1,
    minScaleY: 1,
    maxScaleY: 1,
    startDelayMs: 0,
    preWarmCycles: 0,
    preWarmStepOffset: 1,
    forceDepthWrite: false,
    applyFog: false,
    renderingGroupId: 0,
    billboardMode: 'all',
    emitterType: 'box',
    emitterRadius: 1,
    emitterRadiusRange: 1,
    emitterHeight: 1,
    emitterDirectionRandomizer: 0,
    emitterAngleDeg: 45,
    minEmitBox: { x: -0.2, y: 0, z: -0.2 },
    maxEmitBox: { x: 0.2, y: 0, z: 0.2 },
    direction1: { x: -2, y: 2, z: -2 },
    direction2: { x: 2, y: 5, z: 2 }
  });
};

export const parsePresetMap = (raw: unknown): ParticleEditorPresetMap => {
  if (!isObject(raw)) return {};
  const result: ParticleEditorPresetMap = {};
  Object.entries(raw).forEach(([key, value]) => {
    if (!isObject(value)) return;
    const sanitized = sanitizePreset(
      {
        ...(value as ParticleEditorPreset),
        presetKey: String((value as ParticleEditorPreset).presetKey || key)
      },
      key
    );
    result[sanitized.presetKey] = sanitized;
  });
  return result;
};
