import type { ExclamationMarkBasePreset } from './exclamationMark.types.ts';

export const EXCLAMATION_BASE_CONFIG_URL = '/config/exclamationBasePresets.json';
export type ExclamationBasePreset = ExclamationMarkBasePreset & { presetKey: string; name: string };
export type ExclamationBasePresetMap = Record<string, ExclamationBasePreset>;

const finite = (value: unknown, fallback: number) => Number.isFinite(Number(value)) ? Number(value) : fallback;
export const createDefaultExclamationBasePreset = (presetKey: string, imagePath = ''): ExclamationBasePreset => ({
  presetKey, name: presetKey, enabled: true, imagePath, sizeMode: 'fixed', width: 2.8, height: 0.45,
  scale: 1, scaleX: 1, scaleY: 1, offset: [0, -1.45, 0.01],
  progress: { enabled: true, progress: 0, shape: 'linear', direction: 'forward', angleDeg: 0, startAngleDeg: 0, sweepAngleDeg: 360, innerRadius: 0.65, outerRadius: 1, softness: 0, centerOffsetPx: { x: 0, y: 0 }, axisScale: { x: 1, y: 1 }, filled: { source: 'color', color: '#ffd84d', opacity: 1 }, unfilled: { source: 'texture', color: '#263449', opacity: 0.35 } }
});

export const normalizeExclamationBasePresets = (value: unknown): ExclamationBasePresetMap => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const result: ExclamationBasePresetMap = {};
  for (const [key, raw] of Object.entries(value)) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) continue;
    const source = raw as Partial<ExclamationBasePreset>;
    const fallback = createDefaultExclamationBasePreset(key, source.imagePath ?? '');
    const offset = Array.isArray(source.offset) ? source.offset : fallback.offset;
    result[key] = {
      ...fallback, ...source, presetKey: key, name: source.name?.trim() || key, enabled: source.enabled !== false,
      width: Math.max(0.01, finite(source.width, fallback.width)), height: Math.max(0.01, finite(source.height, fallback.height)),
      scale: Math.max(0.01, finite(source.scale, 1)), scaleX: Math.max(0.01, finite(source.scaleX, 1)), scaleY: Math.max(0.01, finite(source.scaleY, 1)),
      offset: [finite(offset[0], 0), finite(offset[1], -1.45), finite(offset[2], 0.01)],
      progress: { ...fallback.progress, ...(source.progress ?? {}), filled: { ...fallback.progress.filled, ...source.progress?.filled }, unfilled: { ...fallback.progress.unfilled, ...source.progress?.unfilled } }
    };
  }
  return result;
};
