import { Scene, Texture } from '@babylonjs/core';

type CacheEntry = {
  master: Texture;
  refCount: number;
};

const textureCache = new Map<string, CacheEntry>();

const normalizeTexturePath = (texturePath: string): string =>
  texturePath.replace(/^\/+/, '').replace(/\\/g, '/');

/**
 * 取得共享图集纹理的独立 clone（共享 GPU 资源，UV 参数互不影响）。
 */
export const acquireSharedAtlasTexture = (scene: Scene, texturePath: string): Texture => {
  const key = normalizeTexturePath(texturePath);
  let entry = textureCache.get(key);
  if (!entry) {
    const master = new Texture(
      key.startsWith('http') || key.startsWith('data:') ? key : `/${key}`,
      scene,
      false,
      true,
      Texture.TRILINEAR_SAMPLINGMODE
    );
    master.hasAlpha = true;
    master.wrapU = Texture.CLAMP_ADDRESSMODE;
    master.wrapV = Texture.CLAMP_ADDRESSMODE;
    entry = { master, refCount: 0 };
    textureCache.set(key, entry);
  }

  entry.refCount += 1;
  const clone = entry.master.clone();
  clone.hasAlpha = true;
  clone.wrapU = Texture.CLAMP_ADDRESSMODE;
  clone.wrapV = Texture.CLAMP_ADDRESSMODE;
  return clone;
};

/**
 * 释放一次共享引用。clone 本身应由调用方 dispose。
 */
export const releaseSharedAtlasTexture = (texturePath: string): void => {
  const key = normalizeTexturePath(texturePath);
  const entry = textureCache.get(key);
  if (!entry) return;
  entry.refCount = Math.max(0, entry.refCount - 1);
  if (entry.refCount === 0) {
    entry.master.dispose();
    textureCache.delete(key);
  }
};

export const clearSharedAtlasTextureCache = (): void => {
  for (const entry of textureCache.values()) {
    entry.master.dispose();
  }
  textureCache.clear();
};
