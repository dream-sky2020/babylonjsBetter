import { requestDevServer } from '@/core/network/devServerPortResolver.ts';
import { loadConfig } from '@/core/config/configLoader.ts';
import type { ModelSwingConfigLibrary } from '@/core/model/types/model-swing-config.types.ts';
import { sanitizeModelSwingConfigLibrary } from '@/core/model/preset/modelSwingConfigValidation.ts';

export const MODEL_SWING_CONFIG_URL = '/config/modelSwingConfigs.json';
export const MODEL_SWING_CONFIG_API_PATH = '/api/model-swing-configs';

const parseResponse = async (response: Response): Promise<Record<string, unknown>> => {
  const text = await response.text();
  let payload: Record<string, unknown>;
  try { payload = JSON.parse(text) as Record<string, unknown>; }
  catch { throw new Error('模型挥动配置接口没有返回 JSON'); }
  if (!response.ok || payload.success === false) {
    const errors = Array.isArray(payload.errors) ? payload.errors : [];
    throw new Error(`${String(payload.message ?? `HTTP ${response.status}`)}${errors.length ? `：${String(errors[0])}` : ''}`);
  }
  return payload;
};

export const loadModelSwingConfigLibrary = async (): Promise<ModelSwingConfigLibrary> => {
  const value = await loadConfig<unknown>('modelSwingConfigs.json', {
    devApiPath: MODEL_SWING_CONFIG_API_PATH,
    selectDevPayload: (payload) => (payload as Record<string, unknown>).data
  });
  return sanitizeModelSwingConfigLibrary(value);
};

export const saveModelSwingConfigLibrary = async (library: ModelSwingConfigLibrary): Promise<void> => {
  const response = await requestDevServer(MODEL_SWING_CONFIG_API_PATH, {
    method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(library)
  });
  await parseResponse(response);
};
