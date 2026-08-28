import type { ParticleVisualPreset, ParticleVisualPresetMap } from '@/core/particle/types/particle-preset.types.ts';
import { probeDevServerConnection, requestDevServer } from '@/core/network/devServerPortResolver.ts';
import { loadConfig } from '@/core/config/configLoader.ts';
import {
  createDefaultParticleVisualPreset,
  parseParticleVisualPresetMap,
  sanitizeParticleVisualPreset
} from './particleVisualPresetValidation.ts';

const API_PATH = '/api/particle-visual-presets';
let cache: ParticleVisualPresetMap = {};
let hydrated = false;

const readConfig = async (): Promise<ParticleVisualPresetMap> => {
  try {
    return parseParticleVisualPresetMap(await loadConfig<unknown>('particleVisualPresets.json'));
  } catch {
    return {};
  }
};

const writeConfig = async (presets: ParticleVisualPresetMap) => {
  const response = await requestDevServer(API_PATH, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(presets)
  });
  if (!response.ok) throw new Error(`保存视觉预设失败：HTTP ${response.status}`);
};

export const hydrateParticleVisualPresetStorage = async () => {
  if (hydrated) return;
  cache = await readConfig();
  hydrated = true;
};

export const reloadParticleVisualPresetStorage = async () => {
  cache = await readConfig();
  hydrated = true;
};

export const getAllParticleVisualPresets = (): ParticleVisualPresetMap => {
  const result = { ...cache };
  if (Object.keys(result).length === 0) {
    const fallback = createDefaultParticleVisualPreset();
    result[fallback.presetKey] = fallback;
  }
  return result;
};

export const getParticleVisualPreset = (presetKey: string): ParticleVisualPreset => {
  const all = getAllParticleVisualPresets();
  return sanitizeParticleVisualPreset(all[presetKey] ?? all[Object.keys(all)[0]] ?? createDefaultParticleVisualPreset(presetKey));
};

export const saveParticleVisualPreset = async (preset: ParticleVisualPreset) => {
  if (!hydrated) await hydrateParticleVisualPresetStorage();
  const sanitized = sanitizeParticleVisualPreset(preset);
  cache = { ...cache, [sanitized.presetKey]: sanitized };
  await writeConfig(cache);
};

export const removeParticleVisualPreset = async (presetKey: string) => {
  if (!hydrated) await hydrateParticleVisualPresetStorage();
  const next = { ...cache };
  delete next[presetKey];
  cache = next;
  await writeConfig(cache);
};

export const fetchParticleVisualPresetServerConnection = () => probeDevServerConnection(API_PATH);
