import { requestDevServer } from '@/core/network/devServerPortResolver.ts';
import type { ModelShakePresetLibrary } from '@/core/model/types/model-shake-preset.types.ts';
import { sanitizeModelShakePresetLibrary } from '@/core/model/preset/modelShakePresetValidation.ts';

export const MODEL_SHAKE_PRESET_CONFIG_URL = '/config/modelShakePresets.json';
export const MODEL_SHAKE_PRESET_API_PATH = '/api/model-shake-presets';

const parseResponse = async (response: Response): Promise<Record<string, unknown>> => {
  const text = await response.text();
  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(text) as Record<string, unknown>;
  } catch {
    throw new Error('抖动预设接口没有返回 JSON，请确认 python/server.py 已启动');
  }
  if (!response.ok || payload.success === false) {
    const errors = Array.isArray(payload.errors) ? payload.errors : [];
    throw new Error(`${String(payload.message ?? `HTTP ${response.status}`)}${errors.length ? `：${String(errors[0])}` : ''}`);
  }
  return payload;
};

export const loadModelShakePresetLibrary = async (): Promise<ModelShakePresetLibrary> => {
  try {
    const response = await requestDevServer(`${MODEL_SHAKE_PRESET_API_PATH}?t=${Date.now()}`, { method: 'GET' });
    return sanitizeModelShakePresetLibrary((await parseResponse(response)).data);
  } catch {
    const response = await fetch(`${MODEL_SHAKE_PRESET_CONFIG_URL}?t=${Date.now()}`, { cache: 'no-store' });
    if (!response.ok) return {};
    return sanitizeModelShakePresetLibrary(await response.json());
  }
};

export const saveModelShakePresetLibrary = async (library: ModelShakePresetLibrary): Promise<void> => {
  const response = await requestDevServer(MODEL_SHAKE_PRESET_API_PATH, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(library)
  });
  await parseResponse(response);
};
