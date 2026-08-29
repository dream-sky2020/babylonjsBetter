import { readBundledConfig } from '@/core/config';
import { requestDevServer } from '@/core/network/devServerPortResolver';
import type { ModelAssetProfileLibrary } from '../types/model-asset-profile.types';
import { sanitizeModelAssetProfileLibrary } from './modelAssetProfileValidation';

export const MODEL_ASSET_PROFILE_CONFIG_URL = '/config/modelAssetProfiles.json';
export const MODEL_ASSET_PROFILE_API_PATH = '/api/model-asset-profiles';
let cachedLibrary: ModelAssetProfileLibrary | null = null;

export const setModelAssetProfileLibraryCache = (library: ModelAssetProfileLibrary) => {
  cachedLibrary = library;
};
export const loadModelAssetProfileLibrary = async (): Promise<ModelAssetProfileLibrary> => {
  if (cachedLibrary) return cachedLibrary;
  // 模型创建是高频路径，不能因为可选的 Python 写入服务未启动而逐端口等待。
  // Lab 保存成功后会直接更新此缓存；重新启动 Vite 时 JSON 会再次被收录。
  const raw = readBundledConfig<unknown>('modelAssetProfiles.json');
  cachedLibrary = sanitizeModelAssetProfileLibrary(raw);
  return cachedLibrary;
};
export const saveModelAssetProfileLibrary = async (library: ModelAssetProfileLibrary): Promise<void> => {
  const response = await requestDevServer(MODEL_ASSET_PROFILE_API_PATH, {
    method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(library),
  });
  const payload = await response.json() as { success?: boolean; message?: string; errors?: string[] };
  if (!response.ok || payload.success === false) throw new Error(payload.errors?.[0] ?? payload.message ?? `HTTP ${response.status}`);
  cachedLibrary = library;
};
