import type {
  ParticleEditorPreset,
  ParticleEditorPresetMap,
  ParticlePresetSource
} from '@/core/particle/types/particle-preset.types.ts';
import { DEFAULT_PARTICLE_PRESET_KEY } from '@/core/particle/constants/particle.constants.ts';
import {
  readConfigJson,
  writeConfigJsonInDevServer
} from '@/core/particle/preset/particlePresetApi.ts';
import {
  createDefaultParticlePreset,
  sanitizePreset
} from '@/core/particle/preset/particlePresetValidation.ts';

let configPresetCache: ParticleEditorPresetMap = {};
let configHydrated = false;

const readConfigParticlePresets = (): ParticleEditorPresetMap => configPresetCache;

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
  const fallbackPreset =
    allPresets[DEFAULT_PARTICLE_PRESET_KEY] ??
    allPresets[Object.keys(allPresets)[0]] ??
    createDefaultParticlePreset(DEFAULT_PARTICLE_PRESET_KEY);

  if (source === 'config') {
    return sanitizePreset(allPresets[presetKey] ?? fallbackPreset, presetKey);
  }
  if (source === 'local') {
    return sanitizePreset(
      getLocalParticlePreset(presetKey) ?? allPresets[presetKey] ?? fallbackPreset,
      presetKey
    );
  }
  return sanitizePreset(allPresets[presetKey] ?? fallbackPreset, presetKey);
};
