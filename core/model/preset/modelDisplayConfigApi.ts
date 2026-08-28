import { requestDevServer } from '@/core/network/devServerPortResolver.ts';
import { loadConfig } from '@/core/config/configLoader.ts';
import type { ModelDisplayConfigLibrary } from '@/core/model/types/model-display-config.types.ts';
import { sanitizeModelDisplayConfigLibrary } from '@/core/model/preset/modelDisplayConfigValidation.ts';

export const MODEL_DISPLAY_CONFIG_URL = '/config/modelDisplayConfigs.json';
export const MODEL_DISPLAY_CONFIG_API_PATH = '/api/model-display-configs';

const parseResponse = async (response: Response): Promise<Record<string, unknown>> => {
  const text = await response.text();
  let payload: Record<string, unknown>;
  try { payload = JSON.parse(text) as Record<string, unknown>; }
  catch { throw new Error('模型展览配置接口没有返回 JSON，请确认 python/server.py 已启动'); }
  if (!response.ok || payload.success === false) {
    const errors = Array.isArray(payload.errors) ? payload.errors : [];
    throw new Error(`${String(payload.message ?? `HTTP ${response.status}`)}${errors.length ? `：${String(errors[0])}` : ''}`);
  }
  return payload;
};

export const loadModelDisplayConfigLibrary = async (): Promise<ModelDisplayConfigLibrary> => {
  const value = await loadConfig<unknown>('modelDisplayConfigs.json', {
    devApiPath: MODEL_DISPLAY_CONFIG_API_PATH,
    selectDevPayload: (payload) => (payload as Record<string, unknown>).data
  });
  return sanitizeModelDisplayConfigLibrary(value);
};

export const saveModelDisplayConfigLibrary = async (library: ModelDisplayConfigLibrary): Promise<void> => {
  const response = await requestDevServer(MODEL_DISPLAY_CONFIG_API_PATH, {
    method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(library)
  });
  await parseResponse(response);
};
