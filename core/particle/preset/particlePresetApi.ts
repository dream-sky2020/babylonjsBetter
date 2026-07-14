import type { ParticleEditorPresetMap } from '@/core/particle/types/particle-preset.types.ts';
import {
  probeDevServerConnection,
  requestDevServer
} from '@/core/network/devServerPortResolver.ts';
import { parsePresetMap } from '@/core/particle/preset/particlePresetValidation.ts';

const PARTICLE_PRESET_CONFIG_JSON_URL = '/config/particlePresets.json';
const PARTICLE_PRESET_DEV_API_PATH = '/api/particle-presets';

export const readConfigJson = async (): Promise<ParticleEditorPresetMap> => {
  if (typeof window === 'undefined') return {};
  try {
    const response = await fetch(`${PARTICLE_PRESET_CONFIG_JSON_URL}?t=${Date.now()}`, {
      cache: 'no-store'
    });
    if (!response.ok) return {};
    const json = (await response.json()) as unknown;
    return parsePresetMap(json);
  } catch {
    return {};
  }
};

export const writeConfigJsonInDevServer = async (presets: ParticleEditorPresetMap): Promise<void> => {
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
      const payload = (await response.json()) as { message?: string; errors?: string[] };
      const headline = payload.message ? String(payload.message) : '';
      const firstError =
        Array.isArray(payload.errors) && payload.errors.length > 0 ? String(payload.errors[0]) : '';
      detail = [headline, firstError].filter(Boolean).join('；');
    } catch {
      // ignore json parse failure and use status code only
    }
    throw new Error(`保存失败（HTTP ${response.status}${detail ? `: ${detail}` : ''}）`);
  }
};

export const fetchParticlePresetServerConnection = async (): Promise<{
  connected: boolean;
  port: number | null;
}> => {
  return probeDevServerConnection(PARTICLE_PRESET_DEV_API_PATH);
};
