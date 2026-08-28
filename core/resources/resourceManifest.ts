import bundledModelAssets from 'virtual:app-model-assets';
import { resolvePublicResourceUrl } from './appAssetUrl.ts';

/**
 * 模型清单在构建期由 `vite.config.ts` 扫描 `public/resources` 生成，
 * 正式构建不再依赖 `/api/model-assets`。
 */
export const readBundledModelAssetPaths = (): string[] => [...bundledModelAssets];

export const loadModelAssetManifest = async (): Promise<string[]> => {
  if (!import.meta.env.DEV) return readBundledModelAssetPaths();
  try {
    const response = await fetch(`/api/model-assets?t=${Date.now()}`, { cache: 'no-store' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const payload = await response.json() as { assets?: unknown };
    if (!Array.isArray(payload.assets)) throw new Error('模型清单格式不正确');
    return payload.assets.map((asset) => String(asset));
  } catch {
    // 开发服务未就绪时退回构建期清单。
    return readBundledModelAssetPaths();
  }
};

/** 按扩展名过滤模型清单，返回可直接交给加载器的路径。 */
export const loadModelAssetManifestByExtension = async (
  extensionPattern: RegExp
): Promise<string[]> => (await loadModelAssetManifest()).filter((path) => extensionPattern.test(path));

export { resolvePublicResourceUrl };
