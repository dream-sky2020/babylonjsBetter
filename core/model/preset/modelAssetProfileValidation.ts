import type { ModelAssetProfile, ModelAssetProfileLibrary, ModelAssetVector3 } from '../types/model-asset-profile.types';

const finite = (value: unknown, fallback: number, min = -1e9, max = 1e9) => {
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : fallback;
};
const vector = (value: unknown, fallback = 0): ModelAssetVector3 => {
  const raw = value && typeof value === 'object' ? value as Partial<ModelAssetVector3> : {};
  return { x: finite(raw.x, fallback), y: finite(raw.y, fallback), z: finite(raw.z, fallback) };
};
export const normalizeModelAssetProfilePath = (modelPath: string): string => {
  const normalized = modelPath.trim().replace(/\\/g, '/').replace(/^\.\//, '').replace(/^public\//, '');
  return normalized.startsWith('/') ? normalized : `/${normalized}`;
};
export const createDefaultModelAssetProfile = (modelPath: string): ModelAssetProfile => ({
  modelPath: normalizeModelAssetProfilePath(modelPath),
  uniformScale: 1,
  rotationDeg: { x: 0, y: 0, z: 0 },
  positionOffset: { x: 0, y: 0, z: 0 },
  transparencyPolicy: 'depth-safe-cutout',
});
export const sanitizeModelAssetProfile = (raw: unknown, modelPath: string): ModelAssetProfile => {
  const value = raw && typeof raw === 'object' ? raw as Partial<ModelAssetProfile> : {};
  const bounds = value.measuredBounds && typeof value.measuredBounds === 'object' ? {
    size: vector(value.measuredBounds.size), center: vector(value.measuredBounds.center),
  } : undefined;
  return {
    modelPath: normalizeModelAssetProfilePath(modelPath),
    uniformScale: finite(value.uniformScale, 1, 0.000001, 1000000),
    rotationDeg: vector(value.rotationDeg),
    positionOffset: vector(value.positionOffset),
    transparencyPolicy: value.transparencyPolicy === 'source' ? 'source' : 'depth-safe-cutout',
    measuredBounds: bounds,
  };
};
export const sanitizeModelAssetProfileLibrary = (raw: unknown): ModelAssetProfileLibrary => (
  !raw || typeof raw !== 'object' || Array.isArray(raw) ? {} : Object.fromEntries(
    Object.entries(raw).map(([path, profile]) => {
      const normalizedPath = normalizeModelAssetProfilePath(path);
      return [normalizedPath, sanitizeModelAssetProfile(profile, normalizedPath)];
    }),
  )
);
