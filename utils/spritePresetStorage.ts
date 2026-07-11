import { spriteAnchorPresets } from '@app-config/spriteAnchorPresets';
import { invoke } from '@tauri-apps/api/core';
import type {
  NormalizedUv,
  SpriteAnchorPreset,
  SpriteAnchorPresetMap,
  SpriteAtlasFrameMeta
} from '@app-types/sprite-anchors.types';

const SPRITE_ANCHOR_LOCAL_STORAGE_KEY = 'sprite-anchor-presets.v1';
const PRESET_KEY_SEPARATOR = '::';
const ANCHOR_MIN = -1;
const ANCHOR_MAX = 2;
const SPRITE_PRESET_APP_DATA_COMMAND_READ = 'sprite_presets_read_json';
const SPRITE_PRESET_APP_DATA_COMMAND_WRITE = 'sprite_presets_write_json';

let appDataPresetCache: SpriteAnchorPresetMap | null = null;
let appDataHydrated = false;

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));

const clampAnchor = (value: number): number => Math.max(ANCHOR_MIN, Math.min(ANCHOR_MAX, value));
const toFinite = (value: number, fallback: number): number => Number.isFinite(value) ? value : fallback;
const sanitizeAnchorUv = (uv: NormalizedUv, fallback: NormalizedUv): NormalizedUv => ({
  u: clampAnchor(toFinite(uv.u, fallback.u)),
  v: clampAnchor(toFinite(uv.v, fallback.v))
});

const normalizeTexturePath = (texturePath: string): string => {
  const cleaned = texturePath.split('?')[0].split('#')[0];
  const decoded = decodeURI(cleaned);
  return decoded.replace(/^\/+/, '');
};

const isObject = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null;
};

const isTauriRuntime = (): boolean => {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
};

const toFiniteInt = (value: number, fallback: number): number => {
  const finite = toFinite(value, fallback);
  return Math.max(0, Math.round(finite));
};

const sanitizeAtlasFrameMeta = (
  atlasFrame: SpriteAtlasFrameMeta | undefined,
  imagePathFallback: string,
  frameNameFallback: string
): SpriteAtlasFrameMeta | undefined => {
  if (!atlasFrame) return undefined;
  return {
    atlasPath: normalizeTexturePath(atlasFrame.atlasPath || imagePathFallback),
    frameName: atlasFrame.frameName || frameNameFallback,
    frame: {
      x: toFiniteInt(atlasFrame.frame.x, 0),
      y: toFiniteInt(atlasFrame.frame.y, 0),
      w: Math.max(1, toFiniteInt(atlasFrame.frame.w, 1)),
      h: Math.max(1, toFiniteInt(atlasFrame.frame.h, 1))
    },
    spriteSourceSize: {
      x: toFiniteInt(atlasFrame.spriteSourceSize.x, 0),
      y: toFiniteInt(atlasFrame.spriteSourceSize.y, 0),
      w: Math.max(1, toFiniteInt(atlasFrame.spriteSourceSize.w, 1)),
      h: Math.max(1, toFiniteInt(atlasFrame.spriteSourceSize.h, 1))
    },
    sourceSize: {
      w: Math.max(1, toFiniteInt(atlasFrame.sourceSize.w, 1)),
      h: Math.max(1, toFiniteInt(atlasFrame.sourceSize.h, 1))
    },
    atlasSize: {
      w: Math.max(1, toFiniteInt(atlasFrame.atlasSize.w, 1)),
      h: Math.max(1, toFiniteInt(atlasFrame.atlasSize.h, 1))
    },
    rotated: Boolean(atlasFrame.rotated),
    trimmed: Boolean(atlasFrame.trimmed)
  };
};

export const parseSpritePresetKey = (texturePathOrPresetKey: string): { imagePath: string; frameName?: string } => {
  const normalized = normalizeTexturePath(texturePathOrPresetKey);
  const separatorIndex = normalized.indexOf(PRESET_KEY_SEPARATOR);
  if (separatorIndex < 0) return { imagePath: normalized };
  const imagePath = normalized.slice(0, separatorIndex);
  const frameName = normalized.slice(separatorIndex + PRESET_KEY_SEPARATOR.length) || undefined;
  return { imagePath, frameName };
};

export const toSpritePresetKey = (texturePath: string, frameName?: string): string => {
  const normalizedPath = normalizeTexturePath(texturePath);
  return frameName ? `${normalizedPath}${PRESET_KEY_SEPARATOR}${frameName}` : normalizedPath;
};

const resolvePresetIdentity = (
  texturePathOrPresetKey: string,
  frameName?: string
): { imagePath: string; frameName?: string; presetKey: string } => {
  const parsed = parseSpritePresetKey(texturePathOrPresetKey);
  const finalFrameName = frameName ?? parsed.frameName;
  const imagePath = parsed.imagePath;
  return {
    imagePath,
    frameName: finalFrameName,
    presetKey: toSpritePresetKey(imagePath, finalFrameName)
  };
};

const createDefaultPreset = (
  texturePathOrPresetKey: string,
  frameName?: string,
  atlasFrame?: SpriteAtlasFrameMeta
): SpriteAnchorPreset => {
  const identity = resolvePresetIdentity(texturePathOrPresetKey, frameName);
  return {
    presetKey: identity.presetKey,
    imagePath: identity.imagePath,
    frameName: identity.frameName,
    atlasFrame: sanitizeAtlasFrameMeta(atlasFrame, identity.imagePath, identity.frameName ?? ''),
  bodyBounds: {
    minU: 0.2,
    maxU: 0.8,
    minV: 0.1,
    maxV: 0.96
  },
  bodyAxisX: 0.5,
  anchors: {
    head: { u: 0.5, v: 0.12 },
    foot: { u: 0.5, v: 0.95 },
    center: { u: 0.5, v: 0.54 }
  }
  };
};

const sanitizePreset = (preset: SpriteAnchorPreset): SpriteAnchorPreset => {
  const minU = clamp01(Math.min(preset.bodyBounds.minU, preset.bodyBounds.maxU));
  const maxU = clamp01(Math.max(preset.bodyBounds.minU, preset.bodyBounds.maxU));
  const minV = clamp01(Math.min(preset.bodyBounds.minV, preset.bodyBounds.maxV));
  const maxV = clamp01(Math.max(preset.bodyBounds.minV, preset.bodyBounds.maxV));
  const identity = resolvePresetIdentity(
    preset.presetKey || toSpritePresetKey(preset.imagePath, preset.frameName),
    preset.frameName
  );
  const fallback = createDefaultPreset(identity.presetKey, identity.frameName, preset.atlasFrame);
  return {
    presetKey: identity.presetKey,
    imagePath: identity.imagePath,
    frameName: identity.frameName,
    atlasFrame: sanitizeAtlasFrameMeta(
      preset.atlasFrame,
      identity.imagePath,
      identity.frameName ?? fallback.frameName ?? ''
    ),
    bodyBounds: { minU, maxU, minV, maxV },
    bodyAxisX: clampAnchor(toFinite(preset.bodyAxisX, fallback.bodyAxisX)),
    anchors: {
      head: sanitizeAnchorUv(preset.anchors.head, fallback.anchors.head),
      foot: sanitizeAnchorUv(preset.anchors.foot, fallback.anchors.foot),
      center: sanitizeAnchorUv(preset.anchors.center, fallback.anchors.center)
    }
  };
};

const parsePresetMap = (raw: unknown): SpriteAnchorPresetMap => {
  if (!isObject(raw)) return {};
  const result: SpriteAnchorPresetMap = {};
  Object.entries(raw).forEach(([key, value]) => {
    if (!isObject(value)) return;
    const candidate = {
      ...(value as SpriteAnchorPreset),
      presetKey: toSpritePresetKey(key)
    } as SpriteAnchorPreset;
    const sanitized = sanitizePreset(candidate);
    result[sanitized.presetKey] = sanitized;
  });
  return result;
};

const readBrowserSpriteAnchorPresets = (): SpriteAnchorPresetMap => {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(SPRITE_ANCHOR_LOCAL_STORAGE_KEY);
    if (!raw) return {};
    return parsePresetMap(JSON.parse(raw) as unknown);
  } catch {
    return {};
  }
};

const readLocalSpriteAnchorPresets = (): SpriteAnchorPresetMap => {
  if (isTauriRuntime()) return appDataPresetCache ?? {};
  return readBrowserSpriteAnchorPresets();
};

const persistSpriteAnchorPresets = (presets: SpriteAnchorPresetMap): void => {
  if (!isTauriRuntime()) {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(SPRITE_ANCHOR_LOCAL_STORAGE_KEY, JSON.stringify(presets));
    return;
  }

  const payload = JSON.stringify(presets);
  void invoke(SPRITE_PRESET_APP_DATA_COMMAND_WRITE, { json: payload }).catch(() => {
    // Keep in-memory cache even if disk write failed; UI should remain responsive.
  });
};

export const hydrateSpriteAnchorPresetStorage = async (): Promise<void> => {
  if (!isTauriRuntime()) return;
  if (appDataHydrated) return;
  try {
    const raw = await invoke<string>(SPRITE_PRESET_APP_DATA_COMMAND_READ);
    appDataPresetCache = parsePresetMap(JSON.parse(raw) as unknown);
  } catch {
    appDataPresetCache = {};
  }
  appDataHydrated = true;
};

export const saveSpriteAnchorPreset = (preset: SpriteAnchorPreset): void => {
  if (typeof window === 'undefined') return;
  const sanitized = sanitizePreset(preset);
  const saved = readLocalSpriteAnchorPresets();
  saved[sanitized.presetKey] = sanitized;
  if (isTauriRuntime()) appDataPresetCache = saved;
  persistSpriteAnchorPresets(saved);
};

export const removeSpriteAnchorPreset = (texturePathOrPresetKey: string, frameName?: string): void => {
  if (typeof window === 'undefined') return;
  const { presetKey } = resolvePresetIdentity(texturePathOrPresetKey, frameName);
  const saved = readLocalSpriteAnchorPresets();
  delete saved[presetKey];
  if (isTauriRuntime()) appDataPresetCache = saved;
  persistSpriteAnchorPresets(saved);
};

export const getLocalSpriteAnchorPreset = (
  texturePathOrPresetKey: string,
  frameName?: string
): SpriteAnchorPreset | null => {
  const identity = resolvePresetIdentity(texturePathOrPresetKey, frameName);
  const local = readLocalSpriteAnchorPresets();
  const preset = local[identity.presetKey];
  return preset ? sanitizePreset({ ...preset, presetKey: identity.presetKey }) : null;
};

export const hasLocalSpriteAnchorPreset = (texturePathOrPresetKey: string, frameName?: string): boolean => {
  return getLocalSpriteAnchorPreset(texturePathOrPresetKey, frameName) !== null;
};

export const getAllSpriteAnchorPresets = (): SpriteAnchorPresetMap => {
  const merged: SpriteAnchorPresetMap = {};
  Object.entries(spriteAnchorPresets).forEach(([key, value]) => {
    const sanitized = sanitizePreset({ ...value, presetKey: toSpritePresetKey(key) });
    merged[sanitized.presetKey] = sanitized;
  });
  Object.entries(readLocalSpriteAnchorPresets()).forEach(([key, value]) => {
    const sanitized = sanitizePreset({ ...value, presetKey: toSpritePresetKey(key) });
    merged[sanitized.presetKey] = sanitized;
  });
  return merged;
};

export type SpritePresetSource = 'merged' | 'config' | 'local';

export const getSpriteAnchorPreset = (
  texturePathOrPresetKey: string,
  source: SpritePresetSource = 'merged',
  frameName?: string
): SpriteAnchorPreset => {
  const identity = resolvePresetIdentity(texturePathOrPresetKey, frameName);
  const preset: SpriteAnchorPreset | null = (() => {
    if (source === 'config') {
      const configPreset = spriteAnchorPresets[identity.presetKey] ?? spriteAnchorPresets[identity.imagePath];
      return configPreset ? sanitizePreset({ ...configPreset, presetKey: identity.presetKey }) : null;
    }
    if (source === 'local') {
      return getLocalSpriteAnchorPreset(identity.presetKey);
    }
    const merged = getAllSpriteAnchorPresets();
    return merged[identity.presetKey] ?? merged[identity.imagePath] ?? null;
  })();

  const resolvedPreset = preset ?? createDefaultPreset(identity.presetKey, identity.frameName);
  return sanitizePreset({
    ...resolvedPreset,
    presetKey: identity.presetKey,
    imagePath: identity.imagePath,
    frameName: identity.frameName
  });
};
