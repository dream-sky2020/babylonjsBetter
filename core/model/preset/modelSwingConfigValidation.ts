import type { ModelSwingConfig, ModelSwingConfigLibrary } from '@/core/model/types/model-swing-config.types.ts';

const numberInRange = (value: unknown, fallback: number, min: number, max: number) => {
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : fallback;
};

export const createDefaultModelSwingConfig = (modelPath: string): ModelSwingConfig => ({
  modelPath,
  enabled: true,
  baseRotationDeg: { x: 0, y: 0, z: 0 },
  axis: 'y',
  minAngleDeg: -12,
  maxAngleDeg: 12,
  frequencyHz: 1.2,
  phaseDeg: 0
});

export const sanitizeModelSwingConfig = (raw: unknown, fallbackPath = ''): ModelSwingConfig => {
  const value = raw && typeof raw === 'object' ? raw as Partial<ModelSwingConfig> : {};
  const rotation: Partial<ModelSwingConfig['baseRotationDeg']> = value.baseRotationDeg && typeof value.baseRotationDeg === 'object'
    ? value.baseRotationDeg
    : {};
  const fallback = createDefaultModelSwingConfig(fallbackPath);
  const minimum = numberInRange(value.minAngleDeg, fallback.minAngleDeg, -360, 360);
  const maximum = numberInRange(value.maxAngleDeg, fallback.maxAngleDeg, -360, 360);
  return {
    modelPath: typeof value.modelPath === 'string' && value.modelPath.trim() ? value.modelPath.trim() : fallbackPath,
    enabled: typeof value.enabled === 'boolean' ? value.enabled : fallback.enabled,
    baseRotationDeg: {
      x: numberInRange(rotation.x, 0, -360, 360),
      y: numberInRange(rotation.y, 0, -360, 360),
      z: numberInRange(rotation.z, 0, -360, 360)
    },
    axis: value.axis === 'x' || value.axis === 'z' ? value.axis : 'y',
    minAngleDeg: Math.min(minimum, maximum),
    maxAngleDeg: Math.max(minimum, maximum),
    frequencyHz: numberInRange(value.frequencyHz, fallback.frequencyHz, 0.01, 30),
    phaseDeg: numberInRange(value.phaseDeg, 0, -360, 360)
  };
};

export const sanitizeModelSwingConfigLibrary = (raw: unknown): ModelSwingConfigLibrary => {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  return Object.fromEntries(Object.entries(raw).map(([modelPath, config]) => [modelPath, sanitizeModelSwingConfig(config, modelPath)]));
};
