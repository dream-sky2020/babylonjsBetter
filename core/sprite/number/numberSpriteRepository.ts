import type { NumberSpritePreset, NumberSpritePresetMap } from './numberSprite.types.ts';

export const NUMBER_SPRITE_CONFIG_URL = '/config/numberSpriteConfigs.json';

let cachedPresets: NumberSpritePresetMap = {};

export const loadNumberSpritePresets = async (force = false): Promise<NumberSpritePresetMap> => {
  if (!force && Object.keys(cachedPresets).length > 0) return cachedPresets;
  const response = await fetch(NUMBER_SPRITE_CONFIG_URL, { cache: force ? 'no-store' : 'default' });
  if (!response.ok) throw new Error(`数字精灵配置加载失败：HTTP ${response.status}`);
  const value = await response.json() as unknown;
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('数字精灵配置根节点必须是对象');
  }
  cachedPresets = value as NumberSpritePresetMap;
  return cachedPresets;
};

export const getNumberSpritePresets = (): NumberSpritePresetMap => cachedPresets;

export const getNumberSpritePreset = (presetKey: string): NumberSpritePreset | undefined =>
  cachedPresets[presetKey];
