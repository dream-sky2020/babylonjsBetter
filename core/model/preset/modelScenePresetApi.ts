import { requestDevServer } from '@/core/network/devServerPortResolver.ts';
import type { ModelScenePresetLibrary } from '@/core/model/types/model-scene-preset.types.ts';
import { sanitizeModelScenePresetLibrary } from '@/core/model/preset/modelScenePresetValidation.ts';

export const MODEL_SCENE_PRESET_CONFIG_URL = '/config/modelScenePresets.json';
export const MODEL_SCENE_PRESET_API_PATH = '/api/model-scene-presets';

const parseResponse = async (response: Response): Promise<Record<string, unknown>> => {
  const text = await response.text();
  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(text) as Record<string, unknown>;
  } catch {
    throw new Error('场景预设接口没有返回 JSON，请确认 python/server.py 已启动');
  }
  if (!response.ok || payload.success === false) {
    const errors = Array.isArray(payload.errors) ? payload.errors : [];
    throw new Error(`${String(payload.message ?? `HTTP ${response.status}`)}${errors.length ? `：${String(errors[0])}` : ''}`);
  }
  return payload;
};

export const loadModelScenePresetLibrary = async (): Promise<ModelScenePresetLibrary> => {
  try {
    const response = await requestDevServer(`${MODEL_SCENE_PRESET_API_PATH}?t=${Date.now()}`, { method: 'GET' });
    const payload = await parseResponse(response);
    return sanitizeModelScenePresetLibrary(payload.data);
  } catch {
    const response = await fetch(`${MODEL_SCENE_PRESET_CONFIG_URL}?t=${Date.now()}`, { cache: 'no-store' });
    if (!response.ok) return {};
    return sanitizeModelScenePresetLibrary(await response.json());
  }
};

export const saveModelScenePresetLibrary = async (library: ModelScenePresetLibrary): Promise<void> => {
  const response = await requestDevServer(MODEL_SCENE_PRESET_API_PATH, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(library)
  });
  await parseResponse(response);
};
