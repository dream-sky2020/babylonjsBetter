import type { ExclamationMarkPreset, ExclamationMarkPresetMap } from './exclamationMark.types.ts';
import { loadConfig } from '@/core/config/configLoader.ts';

export const EXCLAMATION_MARK_CONFIG_URL = '/config/exclamationMarkPresets.json';

const finite = (value: unknown, fallback: number): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const normalizePath = (value: unknown): string => {
  if (typeof value !== 'string') return '';
  try {
    return decodeURI(value).replace(/^https?:\/\/[^/]+/i, '').replace(/^\/+/, '').replace(/^public\/+/, '');
  } catch {
    return value.replace(/^\/+/, '').replace(/^public\/+/, '');
  }
};

export const createDefaultExclamationMarkPreset = (presetKey: string, imagePath = ''): ExclamationMarkPreset => ({
  presetKey,
  name: presetKey,
  imagePath: normalizePath(imagePath),
  sizeMode: 'preserve-aspect',
  width: 2.4,
  height: 2.4,
  scale: 1,
  scaleX: 1,
  scaleY: 1,
  position: [0, 2.25, 0],
  faceCamera: true,
  progress: {
    enabled: true, progress: 1, shape: 'linear', direction: 'forward', angleDeg: 90,
    startAngleDeg: 0, sweepAngleDeg: 360, innerRadius: 0.65, outerRadius: 1,
    softness: 0, centerOffsetPx: { x: 0, y: 0 }, axisScale: { x: 1, y: 1 },
    filled: { source: 'color', color: '#ffd84d', opacity: 1 },
    unfilled: { source: 'texture', color: '#263449', opacity: 1 }
  },
  base: {
    enabled: false, imagePath: normalizePath(imagePath), sizeMode: 'fixed', width: 2.8, height: 0.45, scale: 1, scaleX: 1, scaleY: 1,
    offset: [0, -1.45, 0.01],
    progress: {
      enabled: true, progress: 0, shape: 'linear', direction: 'forward', angleDeg: 0,
      startAngleDeg: 0, sweepAngleDeg: 360, innerRadius: 0.65, outerRadius: 1,
      softness: 0, centerOffsetPx: { x: 0, y: 0 }, axisScale: { x: 1, y: 1 },
      filled: { source: 'color', color: '#ffd84d', opacity: 1 },
      unfilled: { source: 'texture', color: '#263449', opacity: 0.35 }
    }
  }
});

export const normalizeExclamationMarkPresets = (value: unknown): ExclamationMarkPresetMap => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const result: ExclamationMarkPresetMap = {};
  for (const [key, raw] of Object.entries(value)) {
    if (!key.trim() || !raw || typeof raw !== 'object' || Array.isArray(raw)) continue;
    const source = raw as Partial<ExclamationMarkPreset> & Record<string, unknown>;
    const rawPosition = Array.isArray(source.position) ? source.position : [];
    const rawProgress = source.progress && typeof source.progress === 'object' ? source.progress : {};
    const rawBase = source.base && typeof source.base === 'object' ? source.base : {};
    const legacyDirection = source.fillDirection;
    const legacyVertical = legacyDirection === 'bottom-to-top' || legacyDirection === 'top-to-bottom';
    const legacyReverse = legacyDirection === 'top-to-bottom' || legacyDirection === 'right-to-left';
    const shape = ['none', 'linear', 'radial', 'sector', 'ring', 'diamond', 'box', 'rect-perimeter'].includes(String(rawProgress.shape))
      ? rawProgress.shape as ExclamationMarkPreset['progress']['shape'] : 'linear';
    const direction = ['forward', 'reverse', 'center-out', 'edges-in'].includes(String(rawProgress.direction))
      ? rawProgress.direction as ExclamationMarkPreset['progress']['direction'] : legacyReverse ? 'reverse' : 'forward';
    const normalizeStyle = (style: unknown, legacyPrefix: 'fill' | 'background') => {
      const item = style && typeof style === 'object' ? style as Record<string, unknown> : {};
      const legacyMode = source[`${legacyPrefix}Mode`];
      const legacyColor = source[`${legacyPrefix}Color`];
      const legacyOpacity = source[`${legacyPrefix}Opacity`];
      return {
        source: item.source === 'color' || item.source === 'texture' ? item.source : legacyMode === 'color' ? 'color' : 'texture',
        color: typeof item.color === 'string' ? item.color : typeof legacyColor === 'string' ? legacyColor : legacyPrefix === 'fill' ? '#ffd84d' : '#263449',
        opacity: Math.max(0, Math.min(1, finite(item.opacity, finite(legacyOpacity, 1))))
      } as const;
    };
    result[key] = {
      presetKey: key,
      name: typeof source.name === 'string' && source.name.trim() ? source.name : key,
      imagePath: normalizePath(source.imagePath),
      sizeMode: source.sizeMode === 'fixed' ? 'fixed' : 'preserve-aspect',
      width: Math.max(0.01, finite(source.width, finite(source.height, 2.4))),
      height: Math.max(0.01, finite(source.height, 2.4)),
      scale: Math.max(0.01, finite(source.scale, 1)),
      scaleX: Math.max(0.01, finite(source.scaleX, 1)),
      scaleY: Math.max(0.01, finite(source.scaleY, 1)),
      position: [
        finite(rawPosition[0], 0),
        finite(rawPosition[1], 2.25),
        finite(rawPosition[2], 0)
      ],
      faceCamera: source.faceCamera !== false,
      progress: {
        enabled: rawProgress.enabled !== false,
        progress: Math.max(0, Math.min(1, finite(rawProgress.progress, finite(source.fillPercent, 1)))),
        shape, direction,
        angleDeg: finite(rawProgress.angleDeg, legacyVertical ? 90 : 0),
        startAngleDeg: finite(rawProgress.startAngleDeg, 0),
        sweepAngleDeg: Math.max(0.001, Math.min(360, Math.abs(finite(rawProgress.sweepAngleDeg, 360)))),
        innerRadius: Math.max(0, Math.min(1, finite(rawProgress.innerRadius, 0.65))),
        outerRadius: Math.max(0, Math.min(1, finite(rawProgress.outerRadius, 1))),
        softness: Math.max(0, Math.min(0.5, finite(rawProgress.softness, 0))),
        centerOffsetPx: { x: finite(rawProgress.centerOffsetPx?.x, 0), y: finite(rawProgress.centerOffsetPx?.y, 0) },
        axisScale: { x: Math.max(0.001, Math.abs(finite(rawProgress.axisScale?.x, 1))), y: Math.max(0.001, Math.abs(finite(rawProgress.axisScale?.y, 1))) },
        filled: normalizeStyle(rawProgress.filled, 'fill'),
        unfilled: normalizeStyle(rawProgress.unfilled, 'background')
      },
      base: {
        enabled: rawBase.enabled === true,
        imagePath: normalizePath(rawBase.imagePath ?? source.imagePath),
        sizeMode: rawBase.sizeMode === 'preserve-aspect' ? 'preserve-aspect' : 'fixed',
        width: Math.max(0.01, finite(rawBase.width, 2.8)),
        height: Math.max(0.01, finite(rawBase.height, 0.45)),
        scale: Math.max(0.01, finite(rawBase.scale, 1)),
        scaleX: Math.max(0.01, finite(rawBase.scaleX, 1)),
        scaleY: Math.max(0.01, finite(rawBase.scaleY, 1)),
        offset: Array.isArray(rawBase.offset) ? [finite(rawBase.offset[0], 0), finite(rawBase.offset[1], -1.45), finite(rawBase.offset[2], 0.01)] : [0, -1.45, 0.01],
        progress: {
          enabled: rawBase.progress?.enabled !== false,
          progress: Math.max(0, Math.min(1, finite(rawBase.progress?.progress, 0))),
          shape: ['none', 'linear', 'radial', 'sector', 'ring', 'diamond', 'box', 'rect-perimeter'].includes(String(rawBase.progress?.shape)) ? rawBase.progress.shape : 'linear',
          direction: ['forward', 'reverse', 'center-out', 'edges-in'].includes(String(rawBase.progress?.direction)) ? rawBase.progress.direction : 'forward',
          angleDeg: finite(rawBase.progress?.angleDeg, 0), startAngleDeg: finite(rawBase.progress?.startAngleDeg, 0), sweepAngleDeg: finite(rawBase.progress?.sweepAngleDeg, 360),
          innerRadius: finite(rawBase.progress?.innerRadius, 0.65), outerRadius: finite(rawBase.progress?.outerRadius, 1), softness: finite(rawBase.progress?.softness, 0),
          centerOffsetPx: { x: finite(rawBase.progress?.centerOffsetPx?.x, 0), y: finite(rawBase.progress?.centerOffsetPx?.y, 0) },
          axisScale: { x: Math.max(0.001, finite(rawBase.progress?.axisScale?.x, 1)), y: Math.max(0.001, finite(rawBase.progress?.axisScale?.y, 1)) },
          filled: rawBase.progress?.filled ?? { source: 'color', color: '#ffd84d', opacity: 1 },
          unfilled: rawBase.progress?.unfilled ?? { source: 'texture', color: '#263449', opacity: 0.35 }
        }
      }
    };
  }
  return result;
};

export const loadExclamationMarkPresets = async (): Promise<ExclamationMarkPresetMap> => {
  return normalizeExclamationMarkPresets(await loadConfig<unknown>('exclamationMarkPresets.json'));
};
