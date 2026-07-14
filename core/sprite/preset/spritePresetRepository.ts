import type {
  SpriteAnchorPreset,
  SpriteAnchorPresetMap,
  SpritePresetSource
} from '@/core/sprite/types/sprite-anchors.types.ts';
import {
  readConfigJson,
  writeConfigJsonInDevServer
} from '@/core/sprite/preset/spritePresetApi.ts';
import { resolvePresetIdentity, toSpritePresetKey } from '@/core/sprite/preset/spritePresetKeys.ts';
import {
  createDefaultPreset,
  sanitizePreset
} from '@/core/sprite/preset/spritePresetValidation.ts';

let configPresetCache: SpriteAnchorPresetMap = {};
let configHydrated = false;

const readConfigSpriteAnchorPresets = (): SpriteAnchorPresetMap => configPresetCache;

export const hydrateSpriteAnchorPresetStorage = async (): Promise<void> => {
  if (configHydrated) return;
  configPresetCache = await readConfigJson();
  configHydrated = true;
};

export const reloadSpriteAnchorPresetStorage = async (): Promise<void> => {
  configPresetCache = await readConfigJson();
  configHydrated = true;
};

export const saveSpriteAnchorPreset = async (preset: SpriteAnchorPreset): Promise<void> => {
  if (!configHydrated) {
    await hydrateSpriteAnchorPresetStorage();
  }
  const sanitized = sanitizePreset(preset);
  const saved = { ...readConfigSpriteAnchorPresets() };
  saved[sanitized.presetKey] = sanitized;
  configPresetCache = saved;
  await writeConfigJsonInDevServer(saved);
};

export const removeSpriteAnchorPreset = async (
  texturePathOrPresetKey: string,
  frameName?: string
): Promise<void> => {
  if (!configHydrated) {
    await hydrateSpriteAnchorPresetStorage();
  }
  const { presetKey } = resolvePresetIdentity(texturePathOrPresetKey, frameName);
  const saved = { ...readConfigSpriteAnchorPresets() };
  delete saved[presetKey];
  configPresetCache = saved;
  await writeConfigJsonInDevServer(saved);
};

export const getLocalSpriteAnchorPreset = (
  texturePathOrPresetKey: string,
  frameName?: string
): SpriteAnchorPreset | null => {
  const identity = resolvePresetIdentity(texturePathOrPresetKey, frameName);
  const local = readConfigSpriteAnchorPresets();
  const preset = local[identity.presetKey];
  return preset ? sanitizePreset({ ...preset, presetKey: identity.presetKey }) : null;
};

export const hasLocalSpriteAnchorPreset = (
  texturePathOrPresetKey: string,
  frameName?: string
): boolean => {
  return getLocalSpriteAnchorPreset(texturePathOrPresetKey, frameName) !== null;
};

export const getAllSpriteAnchorPresets = (): SpriteAnchorPresetMap => {
  const merged: SpriteAnchorPresetMap = {};
  Object.entries(readConfigSpriteAnchorPresets()).forEach(([key, value]) => {
    const sanitized = sanitizePreset({ ...value, presetKey: toSpritePresetKey(key) });
    merged[sanitized.presetKey] = sanitized;
  });
  return merged;
};

export const getSpriteAnchorPreset = (
  texturePathOrPresetKey: string,
  source: SpritePresetSource = 'merged',
  frameName?: string
): SpriteAnchorPreset => {
  const identity = resolvePresetIdentity(texturePathOrPresetKey, frameName);
  const preset: SpriteAnchorPreset | null = (() => {
    const merged = getAllSpriteAnchorPresets();
    if (source === 'config' || source === 'local' || source === 'merged') {
      return merged[identity.presetKey] ?? merged[identity.imagePath] ?? null;
    }
    return null;
  })();

  const resolvedPreset = preset ?? createDefaultPreset(identity.presetKey, identity.frameName);
  return sanitizePreset({
    ...resolvedPreset,
    presetKey: identity.presetKey,
    imagePath: identity.imagePath,
    frameName: identity.frameName
  });
};
