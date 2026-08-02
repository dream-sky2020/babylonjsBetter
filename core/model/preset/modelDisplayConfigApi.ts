import { requestDevServer } from '@/core/network/devServerPortResolver.ts';
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
  try {
    const response = await requestDevServer(`${MODEL_DISPLAY_CONFIG_API_PATH}?t=${Date.now()}`, { method: 'GET' });
    return sanitizeModelDisplayConfigLibrary((await parseResponse(response)).data);
  } catch {
    const response = await fetch(`${MODEL_DISPLAY_CONFIG_URL}?t=${Date.now()}`, { cache: 'no-store' });
    if (!response.ok) return {};
    return sanitizeModelDisplayConfigLibrary(await response.json());
  }
};

export const saveModelDisplayConfigLibrary = async (library: ModelDisplayConfigLibrary): Promise<void> => {
  const response = await requestDevServer(MODEL_DISPLAY_CONFIG_API_PATH, {
    method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(library)
  });
  await parseResponse(response);
};
