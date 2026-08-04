import type { ExclamationMarkPreset, ExclamationMarkPresetMap } from './exclamationMark.types.ts';

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
  height: 2.4,
  scale: 1,
  position: [0, 2.25, 0],
  faceCamera: true,
  fillPercent: 1,
  fillDirection: 'bottom-to-top',
  fillMode: 'color',
  fillColor: '#ffd84d',
  fillOpacity: 1,
  backgroundMode: 'texture',
  backgroundColor: '#263449',
  backgroundOpacity: 1
});

export const normalizeExclamationMarkPresets = (value: unknown): ExclamationMarkPresetMap => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const result: ExclamationMarkPresetMap = {};
  for (const [key, raw] of Object.entries(value)) {
    if (!key.trim() || !raw || typeof raw !== 'object' || Array.isArray(raw)) continue;
    const source = raw as Partial<ExclamationMarkPreset>;
    const rawPosition = Array.isArray(source.position) ? source.position : [];
    result[key] = {
      presetKey: key,
      name: typeof source.name === 'string' && source.name.trim() ? source.name : key,
      imagePath: normalizePath(source.imagePath),
      height: Math.max(0.01, finite(source.height, 2.4)),
      scale: Math.max(0.01, finite(source.scale, 1)),
      position: [
        finite(rawPosition[0], 0),
        finite(rawPosition[1], 2.25),
        finite(rawPosition[2], 0)
      ],
      faceCamera: source.faceCamera !== false,
      fillPercent: Math.max(0, Math.min(1, finite(source.fillPercent, 1))),
      fillDirection: source.fillDirection === 'top-to-bottom'
        || source.fillDirection === 'left-to-right'
        || source.fillDirection === 'right-to-left'
        ? source.fillDirection
        : 'bottom-to-top',
      fillMode: source.fillMode === 'texture' ? 'texture' : 'color',
      fillColor: typeof source.fillColor === 'string' ? source.fillColor : '#ffd84d',
      fillOpacity: Math.max(0, Math.min(1, finite(source.fillOpacity, 1))),
      backgroundMode: source.backgroundMode === 'color' ? 'color' : 'texture',
      backgroundColor: typeof source.backgroundColor === 'string' ? source.backgroundColor : '#263449',
      backgroundOpacity: Math.max(0, Math.min(1, finite(source.backgroundOpacity, 1)))
    };
  }
  return result;
};

export const loadExclamationMarkPresets = async (): Promise<ExclamationMarkPresetMap> => {
  const response = await fetch(`${EXCLAMATION_MARK_CONFIG_URL}?t=${Date.now()}`, { cache: 'no-store' });
  if (!response.ok) {
    if (response.status === 404) return {};
    throw new Error(`感叹号配置加载失败：HTTP ${response.status}`);
  }
  return normalizeExclamationMarkPresets(await response.json());
};
