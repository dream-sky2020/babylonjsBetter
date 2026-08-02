import type { ModelDisplayConfig, ModelDisplayConfigLibrary } from '@/core/model/types/model-display-config.types.ts';

const finiteInRange = (value: unknown, fallback: number, min: number, max: number) => {
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : fallback;
};

export const createDefaultModelDisplayConfig = (modelPath: string): ModelDisplayConfig => ({
  modelPath,
  rotationDeg: { x: 0, y: 0, z: 0 },
  scale: 1,
  cameraDistance: 3,
  rotationSpeedDegPerSec: 20
});

export const sanitizeModelDisplayConfig = (raw: unknown, fallbackPath = ''): ModelDisplayConfig => {
  const value = raw && typeof raw === 'object' ? raw as Partial<ModelDisplayConfig> : {};
  const rotation: Partial<ModelDisplayConfig['rotationDeg']> = value.rotationDeg && typeof value.rotationDeg === 'object'
    ? value.rotationDeg
    : {};
  const modelPath = typeof value.modelPath === 'string' && value.modelPath.trim() ? value.modelPath.trim() : fallbackPath;
  return {
    modelPath,
    rotationDeg: {
      x: finiteInRange(rotation.x, 0, -360, 360),
      y: finiteInRange(rotation.y, 0, -360, 360),
      z: finiteInRange(rotation.z, 0, -360, 360)
    },
    scale: finiteInRange(value.scale, 1, 0.001, 1000),
    cameraDistance: finiteInRange(value.cameraDistance, 3, 0.01, 100000),
    rotationSpeedDegPerSec: finiteInRange(value.rotationSpeedDegPerSec, 20, -720, 720)
  };
};

export const sanitizeModelDisplayConfigLibrary = (raw: unknown): ModelDisplayConfigLibrary => {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  return Object.fromEntries(Object.entries(raw).map(([modelPath, config]) => [
    modelPath,
    sanitizeModelDisplayConfig(config, modelPath)
  ]));
};
