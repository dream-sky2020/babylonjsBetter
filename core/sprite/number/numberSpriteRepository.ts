import type { NumberSpritePreset, NumberSpritePresetMap } from './numberSprite.types.ts';
import { loadConfig } from '@/core/config/configLoader.ts';

export const NUMBER_SPRITE_CONFIG_URL = '/config/numberSpriteConfigs.json';

let cachedPresets: NumberSpritePresetMap = {};

const DEFAULT_NUMBER_SPRITE_PRESET: Omit<NumberSpritePreset, 'presetKey' | 'name' | 'glyphs'> = {
  height: 1.5,
  spacing: 0.08,
  groupingEnabled: false,
  groupingExtraSpacing: 0.2,
  alignment: 'center',
  billboard: true
};

const finite = (value: unknown, fallback: number): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export const normalizeNumberSpritePresets = (value: unknown): NumberSpritePresetMap => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const result: NumberSpritePresetMap = {};
  for (const [key, raw] of Object.entries(value)) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) continue;
    const source = raw as Partial<NumberSpritePreset>;
    result[key] = {
      presetKey: key,
      name: typeof source.name === 'string' && source.name.trim() ? source.name : key,
      height: Math.max(0.01, finite(source.height, DEFAULT_NUMBER_SPRITE_PRESET.height)),
      // 字符间距属于可持久化 preset；允许负值以支持紧凑/重叠排版。
      spacing: Math.max(-100, Math.min(100, finite(source.spacing, DEFAULT_NUMBER_SPRITE_PRESET.spacing))),
      groupingEnabled: source.groupingEnabled === true,
      groupingExtraSpacing: Math.max(
        0,
        finite(source.groupingExtraSpacing, DEFAULT_NUMBER_SPRITE_PRESET.groupingExtraSpacing)
      ),
      alignment: source.alignment === 'left' || source.alignment === 'right'
        ? source.alignment
        : 'center',
      billboard: source.billboard !== false,
      glyphs: source.glyphs && typeof source.glyphs === 'object' ? source.glyphs : {}
    };
  }
  return result;
};

export const loadNumberSpritePresets = async (force = false): Promise<NumberSpritePresetMap> => {
  if (!force && Object.keys(cachedPresets).length > 0) return cachedPresets;
  const value = await loadConfig<unknown>('numberSpriteConfigs.json');
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('数字精灵配置根节点必须是对象');
  }
  cachedPresets = normalizeNumberSpritePresets(value);
  return cachedPresets;
};

export const getNumberSpritePresets = (): NumberSpritePresetMap => cachedPresets;

export const getNumberSpritePreset = (presetKey: string): NumberSpritePreset | undefined =>
  cachedPresets[presetKey];
