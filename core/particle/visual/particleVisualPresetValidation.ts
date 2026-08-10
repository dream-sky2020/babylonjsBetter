import type {
  ParticleVisualPreset,
  ParticleVisualPresetMap
} from '@/core/particle/types/particle-preset.types.ts';

const isObject = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const finite = (value: unknown, fallback: number) => typeof value === 'number' && Number.isFinite(value) ? value : fallback;

export const createDefaultParticleVisualPreset = (presetKey = 'spark-visual'): ParticleVisualPreset => ({
  presetKey,
  name: presetKey === 'spark-visual' ? 'Spark Visual' : presetKey,
  texturePath: 'particle_white.svg',
  colorMode: 'texture',
  blendMode: 'alpha',
  baseSize: 0.1,
  minSize: 0.1,
  maxSize: 0.1,
  baseColor: { r: 1, g: 1, b: 1, a: 1 },
  colorGradientsEnabled: true,
  sizeGradientsEnabled: true,
  colorGradients: [
    { offset: 0, color: { r: 1, g: 0.95, b: 0.55, a: 1 } },
    { offset: 0.6, color: { r: 1, g: 0.45, b: 0.2, a: 0.65 } },
    { offset: 1, color: { r: 1, g: 0.25, b: 0.1, a: 0 } }
  ],
  sizeGradients: [
    { offset: 0, size: 0.22 },
    { offset: 0.5, size: 0.16 },
    { offset: 1, size: 0.05 }
  ]
});

export const sanitizeParticleVisualPreset = (raw: ParticleVisualPreset, keyFallback?: string): ParticleVisualPreset => {
  const presetKey = String(raw.presetKey || keyFallback || 'unnamed-visual');
  const legacyBaseSize = Math.max(0.0001, finite(raw.baseSize, 0.1));
  const minSize = Math.max(0.0001, finite(raw.minSize, legacyBaseSize));
  return {
    presetKey,
    name: String(raw.name || presetKey),
    texturePath: String(raw.texturePath || 'particle_white.svg').replace(/^\/+/, ''),
    colorMode: raw.colorMode === 'gradient' ? 'gradient' : 'texture',
    blendMode: raw.blendMode === 'add' || raw.blendMode === 'multiply' || raw.blendMode === 'overwrite'
      ? raw.blendMode
      : 'alpha',
    baseSize: legacyBaseSize,
    minSize,
    maxSize: Math.max(minSize, finite(raw.maxSize, legacyBaseSize)),
    baseColor: {
      r: clamp(finite(raw.baseColor?.r, 1), 0, 1),
      g: clamp(finite(raw.baseColor?.g, 1), 0, 1),
      b: clamp(finite(raw.baseColor?.b, 1), 0, 1),
      a: clamp(finite(raw.baseColor?.a, 1), 0, 1)
    },
    colorGradientsEnabled: typeof raw.colorGradientsEnabled === 'boolean'
      ? raw.colorGradientsEnabled
      : Array.isArray(raw.colorGradients) && raw.colorGradients.length > 0,
    sizeGradientsEnabled: typeof raw.sizeGradientsEnabled === 'boolean'
      ? raw.sizeGradientsEnabled
      : Array.isArray(raw.sizeGradients) && raw.sizeGradients.length > 0,
    spriteSheet: raw.spriteSheet ? {
      cellWidth: Math.max(1, Math.round(finite(raw.spriteSheet.cellWidth, 64))),
      cellHeight: Math.max(1, Math.round(finite(raw.spriteSheet.cellHeight, 64))),
      startCellID: Math.max(0, Math.round(finite(raw.spriteSheet.startCellID, 0))),
      endCellID: Math.max(
        Math.max(0, Math.round(finite(raw.spriteSheet.startCellID, 0))),
        Math.round(finite(raw.spriteSheet.endCellID, 0))
      ),
      randomStartCell: raw.spriteSheet.randomStartCell !== false,
      playbackMode: raw.spriteSheet.playbackMode === 'loop' ? 'loop' : 'random-static',
      framesPerSecond: Math.max(0.1, finite(raw.spriteSheet.framesPerSecond, 8))
    } : undefined,
    colorGradients: Array.isArray(raw.colorGradients) ? raw.colorGradients.map((entry) => ({
      offset: clamp(finite(entry.offset, 0), 0, 1),
      color: {
        r: clamp(finite(entry.color?.r, 1), 0, 1),
        g: clamp(finite(entry.color?.g, 1), 0, 1),
        b: clamp(finite(entry.color?.b, 1), 0, 1),
        a: clamp(finite(entry.color?.a, 1), 0, 1)
      }
    })).sort((left, right) => left.offset - right.offset) : [],
    sizeGradients: Array.isArray(raw.sizeGradients) ? raw.sizeGradients.map((entry) => ({
      offset: clamp(finite(entry.offset, 0), 0, 1),
      size: Math.max(0.0001, finite(entry.size, 0.1))
    })).sort((left, right) => left.offset - right.offset) : []
  };
};

export const parseParticleVisualPresetMap = (raw: unknown): ParticleVisualPresetMap => {
  if (!isObject(raw)) return {};
  const result: ParticleVisualPresetMap = {};
  Object.entries(raw).forEach(([key, value]) => {
    if (!isObject(value)) return;
    const preset = sanitizeParticleVisualPreset({ ...(value as ParticleVisualPreset), presetKey: String(value.presetKey || key) }, key);
    result[preset.presetKey] = preset;
  });
  return result;
};
