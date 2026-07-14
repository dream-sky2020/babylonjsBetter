import type {
  NormalizedUv,
  SpriteAnchorPreset,
  SpriteAnchorPresetMap,
  SpriteAtlasFrameMeta
} from '@/core/types/sprite-anchors.types.ts';

const SPRITE_ANCHOR_CONFIG_JSON_URL = '/config/spriteAnchorPresets.json';
const SPRITE_ANCHOR_DEV_API_URL = 'http://127.0.0.1:5050/api/sprite-anchor-presets';
const PRESET_KEY_SEPARATOR = '::';
const ANCHOR_MIN = -1;
const ANCHOR_MAX = 2;

let configPresetCache: SpriteAnchorPresetMap = {};
let configHydrated = false;

export type SpritePresetValidationReport = {
  reachable: boolean;
  valid: boolean;
  errors: string[];
  message?: string;
};

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

const readConfigSpriteAnchorPresets = (): SpriteAnchorPresetMap => configPresetCache;

const readConfigJson = async (): Promise<SpriteAnchorPresetMap> => {
  if (typeof window === 'undefined') return {};
  try {
    const response = await fetch(`${SPRITE_ANCHOR_CONFIG_JSON_URL}?t=${Date.now()}`, {
      cache: 'no-store'
    });
    if (!response.ok) return {};
    const json = await response.json() as unknown;
    return parsePresetMap(json);
  } catch {
    return {};
  }
};

const writeConfigJsonInDevServer = async (presets: SpriteAnchorPresetMap): Promise<void> => {
  const response = await fetch(SPRITE_ANCHOR_DEV_API_URL, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(presets)
  });
  if (!response.ok) {
    let detail = '';
    try {
      const payload = await response.json() as { message?: string; errors?: string[] };
      const headline = payload.message ? String(payload.message) : '';
      const firstError = Array.isArray(payload.errors) && payload.errors.length > 0 ? String(payload.errors[0]) : '';
      detail = [headline, firstError].filter(Boolean).join('；');
    } catch {
      // ignore json parse failure and use status code only
    }
    throw new Error(`保存失败（HTTP ${response.status}${detail ? `: ${detail}` : ''}）`);
  }
};

export const fetchSpritePresetValidationReport = async (): Promise<SpritePresetValidationReport> => {
  try {
    const response = await fetch(`${SPRITE_ANCHOR_DEV_API_URL}?t=${Date.now()}`, {
      cache: 'no-store'
    });
    if (!response.ok) {
      let message = `校验接口请求失败（HTTP ${response.status}）`;
      try {
        const payload = await response.json() as { message?: string };
        if (payload.message) message = String(payload.message);
      } catch {
        // ignore parse failure
      }
      return {
        reachable: false,
        valid: false,
        errors: [],
        message
      };
    }

    const payload = await response.json() as {
      success?: boolean;
      valid?: boolean;
      errors?: unknown;
      message?: string;
    };
    const errors = Array.isArray(payload.errors) ? payload.errors.map((item) => String(item)) : [];
    return {
      reachable: true,
      valid: payload.valid === undefined ? errors.length === 0 : Boolean(payload.valid),
      errors,
      message: payload.message ? String(payload.message) : undefined
    };
  } catch {
    return {
      reachable: false,
      valid: false,
      errors: [],
      message: '无法连接 python/server.py 校验接口'
    };
  }
};

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

export const removeSpriteAnchorPreset = async (texturePathOrPresetKey: string, frameName?: string): Promise<void> => {
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

export const hasLocalSpriteAnchorPreset = (texturePathOrPresetKey: string, frameName?: string): boolean => {
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

export type SpritePresetSource = 'merged' | 'config' | 'local';

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
