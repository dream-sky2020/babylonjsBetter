import type { SpecialStatus3dVector } from '../types/specialStatus3d.types.ts';
import type { SpecialStatusVisualPreset, SpecialStatusVisualPresetMap } from './specialStatusVisualPreset.types.ts';

export const SPECIAL_STATUS_VISUAL_PRESET_CONFIG_URL = '/config/specialStatusVisualPresets.json';
export const SPECIAL_STATUS_VISUAL_PRESET_API_PATH = '/api/special-status-visual-presets';

const finite = (value: unknown, fallback: number): number => typeof value === 'number' && Number.isFinite(value) ? value : fallback;
const vector = (value: unknown, fallback: SpecialStatus3dVector): SpecialStatus3dVector => {
  const source = Array.isArray(value) ? value : [];
  return [finite(source[0], fallback[0]), finite(source[1], fallback[1]), finite(source[2], fallback[2])];
};

export const createDefaultSpecialStatusVisualPreset = (presetKey = 'special_status_default'): SpecialStatusVisualPreset => ({
  presetKey,
  name: '默认特殊状态',
  ui2d: {
    badgeSize: 96, iconScale: 1, valueFontSize: 18, cornerInset: 0, textColor: '#e2e8f0',
    frameOffsetX: 0, frameOffsetY: 0, frameWidth: 420, frameHeight: 300
  },
  babylon3d: {
    numberPresetKey: 'number_default', statusHeight: 2.4, statusScale: 1, numberScale: 1,
    cornerInset: 0, position: [0, 2.25, 0],
    numberOffsets: [[0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0]], billboard: true
  }
});

export const normalizeSpecialStatusVisualPreset = (value: unknown, key: string): SpecialStatusVisualPreset => {
  const source = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  const fallback = createDefaultSpecialStatusVisualPreset(key);
  const ui2d = source.ui2d && typeof source.ui2d === 'object' ? source.ui2d as Record<string, unknown> : {};
  const babylon3d = source.babylon3d && typeof source.babylon3d === 'object' ? source.babylon3d as Record<string, unknown> : {};
  const offsets = Array.isArray(babylon3d.numberOffsets) ? babylon3d.numberOffsets : [];
  return {
    presetKey: key,
    name: typeof source.name === 'string' && source.name.trim() ? source.name : fallback.name,
    ui2d: {
      badgeSize: Math.max(1, finite(ui2d.badgeSize, fallback.ui2d.badgeSize)),
      iconScale: Math.max(0.01, finite(ui2d.iconScale, fallback.ui2d.iconScale)),
      valueFontSize: Math.max(1, finite(ui2d.valueFontSize, fallback.ui2d.valueFontSize)),
      cornerInset: finite(ui2d.cornerInset, fallback.ui2d.cornerInset),
      textColor: typeof ui2d.textColor === 'string' ? ui2d.textColor : fallback.ui2d.textColor,
      frameOffsetX: finite(ui2d.frameOffsetX, fallback.ui2d.frameOffsetX), frameOffsetY: finite(ui2d.frameOffsetY, fallback.ui2d.frameOffsetY),
      frameWidth: Math.max(1, finite(ui2d.frameWidth, fallback.ui2d.frameWidth)), frameHeight: Math.max(1, finite(ui2d.frameHeight, fallback.ui2d.frameHeight))
    },
    babylon3d: {
      numberPresetKey: typeof babylon3d.numberPresetKey === 'string' ? babylon3d.numberPresetKey : fallback.babylon3d.numberPresetKey,
      statusHeight: Math.max(0.01, finite(babylon3d.statusHeight, fallback.babylon3d.statusHeight)),
      statusScale: Math.max(0.01, finite(babylon3d.statusScale, fallback.babylon3d.statusScale)),
      numberScale: Math.max(0.01, finite(babylon3d.numberScale, fallback.babylon3d.numberScale)),
      cornerInset: finite(babylon3d.cornerInset, fallback.babylon3d.cornerInset),
      position: vector(babylon3d.position, fallback.babylon3d.position),
      numberOffsets: [0, 1, 2, 3].map((index) => vector(offsets[index], [0, 0, 0])) as SpecialStatusVisualPreset['babylon3d']['numberOffsets'],
      billboard: babylon3d.billboard !== false
    }
  };
};

export const normalizeSpecialStatusVisualPresets = (value: unknown): SpecialStatusVisualPresetMap => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, preset]) => [key, normalizeSpecialStatusVisualPreset(preset, key)]));
};
