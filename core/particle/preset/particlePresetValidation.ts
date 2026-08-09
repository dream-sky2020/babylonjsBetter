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
    gravityY: toFinite(raw.gravityY, -9.81),
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
    gravityY: -9.81,
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
