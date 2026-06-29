import { particlePresets } from '@app-config/particlePresets';
import type {
  ParticleEditorPreset,
  ParticleEditorPresetMap,
  ParticlePresetSource
} from '@app-types/particle-editor.types';

const PARTICLE_PRESET_LOCAL_STORAGE_KEY = 'particle-editor-presets.v1';

const isObject = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null;
};

const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value));
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

const sanitizePreset = (raw: ParticleEditorPreset, keyFallback?: string): ParticleEditorPreset => {
  const presetKey = String(raw.presetKey || keyFallback || 'unnamed');
  return {
    presetKey,
    name: String(raw.name || presetKey),
    texturePath: String(raw.texturePath || 'particle_white.svg').replace(/^\/+/, ''),
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
    direction2: sanitizeVec3(raw.direction2, { x: 2, y: 5, z: 2 }),
    colorGradients: Array.isArray(raw.colorGradients)
      ? raw.colorGradients
        .map((entry) => ({
          offset: clamp(toFinite(entry.offset, 0), 0, 1),
          color: {
            r: clamp(toFinite(entry.color?.r, 1), 0, 1),
            g: clamp(toFinite(entry.color?.g, 1), 0, 1),
            b: clamp(toFinite(entry.color?.b, 1), 0, 1),
            a: clamp(toFinite(entry.color?.a, 1), 0, 1)
          }
        }))
        .sort((a, b) => a.offset - b.offset)
      : [],
    sizeGradients: Array.isArray(raw.sizeGradients)
      ? raw.sizeGradients
        .map((entry) => ({
          offset: clamp(toFinite(entry.offset, 0), 0, 1),
          size: Math.max(0.0001, toFinite(entry.size, 0.1))
        }))
        .sort((a, b) => a.offset - b.offset)
      : []
  };
};

const readLocalParticlePresets = (): ParticleEditorPresetMap => {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(PARTICLE_PRESET_LOCAL_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!isObject(parsed)) return {};
    const result: ParticleEditorPresetMap = {};
    Object.entries(parsed).forEach(([key, value]) => {
      if (!isObject(value)) return;
      result[key] = sanitizePreset(value as ParticleEditorPreset, key);
    });
    return result;
  } catch {
    return {};
  }
};

const writeLocalParticlePresets = (presets: ParticleEditorPresetMap): void => {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(PARTICLE_PRESET_LOCAL_STORAGE_KEY, JSON.stringify(presets));
};

export const getAllParticlePresets = (): ParticleEditorPresetMap => {
  const merged: ParticleEditorPresetMap = {};
  Object.entries(particlePresets).forEach(([key, value]) => {
    merged[key] = sanitizePreset(value, key);
  });
  Object.entries(readLocalParticlePresets()).forEach(([key, value]) => {
    merged[key] = sanitizePreset(value, key);
  });
  return merged;
};

export const getLocalParticlePreset = (presetKey: string): ParticleEditorPreset | null => {
  const local = readLocalParticlePresets();
  const found = local[presetKey];
  return found ? sanitizePreset(found, presetKey) : null;
};

export const hasLocalParticlePreset = (presetKey: string): boolean => {
  return getLocalParticlePreset(presetKey) !== null;
};

export const saveParticlePreset = (preset: ParticleEditorPreset): void => {
  const sanitized = sanitizePreset(preset);
  const all = readLocalParticlePresets();
  all[sanitized.presetKey] = sanitized;
  writeLocalParticlePresets(all);
};

export const removeParticlePreset = (presetKey: string): void => {
  const all = readLocalParticlePresets();
  delete all[presetKey];
  writeLocalParticlePresets(all);
};

export const getParticlePreset = (
  presetKey: string,
  source: ParticlePresetSource = 'merged'
): ParticleEditorPreset => {
  if (source === 'config') {
    const value = particlePresets[presetKey];
    return sanitizePreset(value ?? particlePresets.spark, presetKey);
  }
  if (source === 'local') {
    return sanitizePreset(getLocalParticlePreset(presetKey) ?? particlePresets[presetKey] ?? particlePresets.spark, presetKey);
  }
  return sanitizePreset(getAllParticlePresets()[presetKey] ?? particlePresets[presetKey] ?? particlePresets.spark, presetKey);
};
