import type {
  ParticleEditorPreset,
  ParticleEditorPresetMap,
  ParticlePresetSource
} from '@/core/types/particle-editor.types.ts';
import {
  probeDevServerConnection,
  requestDevServer
} from '@/core/adapters/devServerPortResolver.ts';

const PARTICLE_PRESET_CONFIG_JSON_URL = '/config/particlePresets.json';
const PARTICLE_PRESET_DEV_API_PATH = '/api/particle-presets';
const DEFAULT_PARTICLE_PRESET_KEY = 'spark';

let configPresetCache: ParticleEditorPresetMap = {};
let configHydrated = false;

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

const createDefaultParticlePreset = (presetKey = DEFAULT_PARTICLE_PRESET_KEY): ParticleEditorPreset => {
  return sanitizePreset({
    presetKey,
    name: presetKey === DEFAULT_PARTICLE_PRESET_KEY ? 'Spark' : presetKey,
    texturePath: 'particle_white.svg',
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
  });
};

const parsePresetMap = (raw: unknown): ParticleEditorPresetMap => {
  if (!isObject(raw)) return {};
  const result: ParticleEditorPresetMap = {};
  Object.entries(raw).forEach(([key, value]) => {
    if (!isObject(value)) return;
    const sanitized = sanitizePreset({
      ...(value as ParticleEditorPreset),
      presetKey: String((value as ParticleEditorPreset).presetKey || key)
    }, key);
    result[sanitized.presetKey] = sanitized;
  });
  return result;
};

const readConfigParticlePresets = (): ParticleEditorPresetMap => configPresetCache;

const readConfigJson = async (): Promise<ParticleEditorPresetMap> => {
  if (typeof window === 'undefined') return {};
  try {
    const response = await fetch(`${PARTICLE_PRESET_CONFIG_JSON_URL}?t=${Date.now()}`, {
      cache: 'no-store'
    });
    if (!response.ok) return {};
    const json = await response.json() as unknown;
    return parsePresetMap(json);
  } catch {
    return {};
  }
};

const writeConfigJsonInDevServer = async (presets: ParticleEditorPresetMap): Promise<void> => {
  const response = await requestDevServer(PARTICLE_PRESET_DEV_API_PATH, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(presets)
  });
  if (!response.ok) {
    let detail = '';
    try {
      const payload = await response.json() as { message?: string; errors?: string[] };
      const headline = payload.message ? String(payload.message) : '';
      const firstError = Array.isArray(payload.errors) && payload.errors.length > 0 ? String(payload.errors[0]) : '';
      detail = [headline, firstError].filter(Boolean).join('；');
    } catch {
      // ignore json parse failure and use status code only
    }
    throw new Error(`保存失败（HTTP ${response.status}${detail ? `: ${detail}` : ''}）`);
  }
};

export const fetchParticlePresetServerConnection = async (): Promise<{ connected: boolean; port: number | null }> => {
  return probeDevServerConnection(PARTICLE_PRESET_DEV_API_PATH);
};

export const hydrateParticlePresetStorage = async (): Promise<void> => {
  if (configHydrated) return;
  configPresetCache = await readConfigJson();
  configHydrated = true;
};

export const reloadParticlePresetStorage = async (): Promise<void> => {
  configPresetCache = await readConfigJson();
  configHydrated = true;
};

export const getAllParticlePresets = (): ParticleEditorPresetMap => {
  const merged: ParticleEditorPresetMap = {};
  Object.entries(readConfigParticlePresets()).forEach(([key, value]) => {
    merged[key] = sanitizePreset(value, key);
  });
  if (!merged[DEFAULT_PARTICLE_PRESET_KEY]) {
    const fallback = createDefaultParticlePreset();
    merged[fallback.presetKey] = fallback;
  }
  return merged;
};

export const getLocalParticlePreset = (presetKey: string): ParticleEditorPreset | null => {
  const local = readConfigParticlePresets();
  const found = local[presetKey];
  return found ? sanitizePreset(found, presetKey) : null;
};

export const hasLocalParticlePreset = (presetKey: string): boolean => {
  return getLocalParticlePreset(presetKey) !== null;
};

export const saveParticlePreset = async (preset: ParticleEditorPreset): Promise<void> => {
  if (!configHydrated) {
    await hydrateParticlePresetStorage();
  }
  const sanitized = sanitizePreset(preset);
  const all = { ...readConfigParticlePresets() };
  all[sanitized.presetKey] = sanitized;
  configPresetCache = all;
  await writeConfigJsonInDevServer(all);
};

export const removeParticlePreset = async (presetKey: string): Promise<void> => {
  if (!configHydrated) {
    await hydrateParticlePresetStorage();
  }
  const all = { ...readConfigParticlePresets() };
  delete all[presetKey];
  configPresetCache = all;
  await writeConfigJsonInDevServer(all);
};

export const getParticlePreset = (
  presetKey: string,
  source: ParticlePresetSource = 'merged'
): ParticleEditorPreset => {
  const allPresets = getAllParticlePresets();
  const fallbackPreset = allPresets[DEFAULT_PARTICLE_PRESET_KEY]
    ?? allPresets[Object.keys(allPresets)[0]]
    ?? createDefaultParticlePreset(DEFAULT_PARTICLE_PRESET_KEY);

  if (source === 'config') {
    return sanitizePreset(allPresets[presetKey] ?? fallbackPreset, presetKey);
  }
  if (source === 'local') {
    return sanitizePreset(getLocalParticlePreset(presetKey) ?? allPresets[presetKey] ?? fallbackPreset, presetKey);
  }
  return sanitizePreset(allPresets[presetKey] ?? fallbackPreset, presetKey);
};
