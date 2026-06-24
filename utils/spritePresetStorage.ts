import { spriteAnchorPresets } from '@app-config/spriteAnchorPresets';
import type { NormalizedUv, SpriteAnchorPreset, SpriteAnchorPresetMap } from '@app-types/sprite-anchors.types';

const SPRITE_ANCHOR_LOCAL_STORAGE_KEY = 'sprite-anchor-presets.v1';
const ANCHOR_MIN = -1;
const ANCHOR_MAX = 2;

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

export const toSpritePresetKey = (texturePath: string): string => normalizeTexturePath(texturePath);

const createDefaultPreset = (imagePath: string): SpriteAnchorPreset => ({
  imagePath,
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
});

const sanitizePreset = (preset: SpriteAnchorPreset): SpriteAnchorPreset => {
  const minU = clamp01(Math.min(preset.bodyBounds.minU, preset.bodyBounds.maxU));
  const maxU = clamp01(Math.max(preset.bodyBounds.minU, preset.bodyBounds.maxU));
  const minV = clamp01(Math.min(preset.bodyBounds.minV, preset.bodyBounds.maxV));
  const maxV = clamp01(Math.max(preset.bodyBounds.minV, preset.bodyBounds.maxV));
  const fallback = createDefaultPreset(normalizeTexturePath(preset.imagePath));
  return {
    imagePath: normalizeTexturePath(preset.imagePath),
    bodyBounds: { minU, maxU, minV, maxV },
    bodyAxisX: clampAnchor(toFinite(preset.bodyAxisX, fallback.bodyAxisX)),
    anchors: {
      head: sanitizeAnchorUv(preset.anchors.head, fallback.anchors.head),
      foot: sanitizeAnchorUv(preset.anchors.foot, fallback.anchors.foot),
      center: sanitizeAnchorUv(preset.anchors.center, fallback.anchors.center)
    }
  };
};

const readLocalSpriteAnchorPresets = (): SpriteAnchorPresetMap => {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(SPRITE_ANCHOR_LOCAL_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as SpriteAnchorPresetMap;
    if (!parsed || typeof parsed !== 'object') return {};

    const result: SpriteAnchorPresetMap = {};
    Object.entries(parsed).forEach(([key, value]) => {
      if (!value) return;
      result[normalizeTexturePath(key)] = sanitizePreset(value);
    });
    return result;
  } catch {
    return {};
  }
};

export const saveSpriteAnchorPreset = (preset: SpriteAnchorPreset): void => {
  if (typeof window === 'undefined') return;
  const sanitized = sanitizePreset(preset);
  const saved = readLocalSpriteAnchorPresets();
  saved[sanitized.imagePath] = sanitized;
  window.localStorage.setItem(SPRITE_ANCHOR_LOCAL_STORAGE_KEY, JSON.stringify(saved));
};

export const removeSpriteAnchorPreset = (imagePath: string): void => {
  if (typeof window === 'undefined') return;
  const normalizedPath = normalizeTexturePath(imagePath);
  const saved = readLocalSpriteAnchorPresets();
  delete saved[normalizedPath];
  window.localStorage.setItem(SPRITE_ANCHOR_LOCAL_STORAGE_KEY, JSON.stringify(saved));
};

export const getLocalSpriteAnchorPreset = (texturePath: string): SpriteAnchorPreset | null => {
  const normalizedPath = normalizeTexturePath(texturePath);
  const local = readLocalSpriteAnchorPresets();
  const preset = local[normalizedPath];
  return preset ? sanitizePreset({ ...preset, imagePath: normalizedPath }) : null;
};

export const hasLocalSpriteAnchorPreset = (texturePath: string): boolean => {
  return getLocalSpriteAnchorPreset(texturePath) !== null;
};

export const getAllSpriteAnchorPresets = (): SpriteAnchorPresetMap => {
  const merged: SpriteAnchorPresetMap = {};
  Object.entries(spriteAnchorPresets).forEach(([key, value]) => {
    merged[normalizeTexturePath(key)] = sanitizePreset(value);
  });
  Object.entries(readLocalSpriteAnchorPresets()).forEach(([key, value]) => {
    merged[normalizeTexturePath(key)] = sanitizePreset(value);
  });
  return merged;
};

export type SpritePresetSource = 'merged' | 'config' | 'local';

export const getSpriteAnchorPreset = (
  texturePath: string,
  source: SpritePresetSource = 'merged'
): SpriteAnchorPreset => {
  const normalizedPath = normalizeTexturePath(texturePath);
  let preset: SpriteAnchorPreset | null = null;

  if (source === 'config') {
    const configPreset = spriteAnchorPresets[normalizedPath];
    preset = configPreset ? sanitizePreset(configPreset) : null;
  } else if (source === 'local') {
    preset = getLocalSpriteAnchorPreset(normalizedPath);
  } else {
    const merged = getAllSpriteAnchorPresets();
    preset = merged[normalizedPath] ?? null;
  }

  const resolvedPreset = preset ?? createDefaultPreset(normalizedPath);
  return sanitizePreset({ ...resolvedPreset, imagePath: normalizedPath });
};
