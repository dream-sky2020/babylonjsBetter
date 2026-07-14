import type { SpriteAnchorPreset } from '@/core/sprite/types/sprite-anchors.types.ts';
import type { SpriteFrameRegion } from '@/core/sprite/types/sprite.types.ts';
import {
  getLocalSpriteAnchorPreset,
  getSpriteAnchorPreset,
  hasLocalSpriteAnchorPreset
} from '@/core/sprite/preset/spritePresetRepository.ts';
import { toSpritePresetKey } from '@/core/sprite/preset/spritePresetKeys.ts';

export type DragTarget = 'head' | 'foot' | 'center' | 'axis' | null;

export type TexturePackerFrameRaw = {
  frame: { x: number; y: number; w: number; h: number };
  rotated: boolean;
  trimmed: boolean;
  spriteSourceSize: { x: number; y: number; w: number; h: number };
  sourceSize: { w: number; h: number };
};

export type TexturePackerAtlas = {
  frames: Record<string, TexturePackerFrameRaw>;
  meta: {
    image: string;
    size: { w: number; h: number };
  };
};

export const RESOURCE_IMAGE_MODULES = import.meta.glob('/public/**/*.{png,jpg,jpeg,webp,gif,avif,svg}', {
  eager: true,
  query: '?url',
  import: 'default'
}) as Record<string, string>;

export const RESOURCE_ATLAS_PATHS = Object.keys(import.meta.glob('/public/**/*.json'));

export const LAST_ATLAS_JSON_STORAGE_KEY = 'sprite-anchor-editor.last-atlas-json-path';
export const LAST_EDITOR_MODE_STORAGE_KEY = 'sprite-anchor-editor.last-mode';
export const DEFAULT_ORTHO_SIZE = 5;
export const MIN_ORTHO_SIZE = 1.5;
export const MAX_ORTHO_SIZE = 14;
export const ZOOM_STEP = 0.1;
export const DRAG_HIT_RADIUS_UV = 0.05;
export const DEFAULT_ATLAS_JSON_PATH = '君主宝(默认).json';
export const INPUT_STEP = 0.0001;
export const ANCHOR_MIN = -1;
export const ANCHOR_MAX = 2;
export const BOUNDS_MIN = 0;
export const BOUNDS_MAX = 1;

export const normalizePublicPath = (input: string): string => {
  return decodeURI(input).replace(/^\/+/, '').replace(/^\.\/+/, '');
};

export const DEFAULT_SCANNED_ATLAS_OPTIONS = RESOURCE_ATLAS_PATHS
  .map((path) => normalizePublicPath(path).replace(/^public\/+/, ''))
  .sort((a, b) => a.localeCompare(b, 'zh-CN'));

export const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));
export const clamp = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, value));
export const toFixedNumber = (value: number): number => Number(value.toFixed(4));

export const joinPublicPath = (basePath: string, relativeOrAbsolutePath: string): string => {
  const normalizedInput = normalizePublicPath(relativeOrAbsolutePath);
  if (normalizedInput.includes('/')) return normalizedInput;
  const normalizedBase = normalizePublicPath(basePath);
  const slashIndex = normalizedBase.lastIndexOf('/');
  if (slashIndex < 0) return normalizedInput;
  return `${normalizedBase.slice(0, slashIndex + 1)}${normalizedInput}`;
};

export const getLastAtlasJsonPath = (): string | null => {
  if (typeof window === 'undefined') return null;
  try {
    const saved = window.localStorage.getItem(LAST_ATLAS_JSON_STORAGE_KEY);
    if (!saved) return null;
    return normalizePublicPath(saved);
  } catch {
    return null;
  }
};

export const saveLastAtlasJsonPath = (atlasJsonPath: string): void => {
  if (typeof window === 'undefined') return;
  try {
    const normalized = normalizePublicPath(atlasJsonPath);
    if (!normalized) return;
    window.localStorage.setItem(LAST_ATLAS_JSON_STORAGE_KEY, normalized);
  } catch {
    // ignore storage errors
  }
};

export const getLastEditorMode = (): 'single' | 'atlas' | null => {
  if (typeof window === 'undefined') return null;
  try {
    const saved = window.localStorage.getItem(LAST_EDITOR_MODE_STORAGE_KEY);
    if (saved === 'single' || saved === 'atlas') return saved;
    return null;
  } catch {
    return null;
  }
};

export const saveLastEditorMode = (mode: 'single' | 'atlas'): void => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(LAST_EDITOR_MODE_STORAGE_KEY, mode);
  } catch {
    // ignore storage errors
  }
};

export const toFrameRegion = (
  atlasPath: string,
  atlasImagePath: string,
  frameName: string,
  frame: TexturePackerFrameRaw,
  atlasSize: { w: number; h: number }
): SpriteFrameRegion & { atlasPath: string; atlasImagePath: string } => {
  return {
    atlasPath,
    atlasImagePath,
    frameName,
    frame: {
      x: frame.frame.x,
      y: frame.frame.y,
      w: frame.frame.w,
      h: frame.frame.h
    },
    spriteSourceSize: {
      x: frame.spriteSourceSize.x,
      y: frame.spriteSourceSize.y,
      w: frame.spriteSourceSize.w,
      h: frame.spriteSourceSize.h
    },
    sourceSize: {
      w: frame.sourceSize.w,
      h: frame.sourceSize.h
    },
    atlasSize: {
      w: atlasSize.w,
      h: atlasSize.h
    },
    rotated: frame.rotated,
    trimmed: frame.trimmed
  };
};

export const createEditablePreset = (
  imagePath: string,
  frameName?: string,
  atlasFrame?: SpriteAnchorPreset['atlasFrame']
): SpriteAnchorPreset => {
  const presetKey = toSpritePresetKey(imagePath, frameName);
  const localPreset = getLocalSpriteAnchorPreset(presetKey);
  if (localPreset) {
    return {
      ...localPreset,
      presetKey,
      imagePath,
      frameName,
      atlasFrame: atlasFrame ?? localPreset.atlasFrame
    };
  }
  const mergedPreset = getSpriteAnchorPreset(presetKey);
  return {
    ...mergedPreset,
    presetKey,
    imagePath,
    frameName,
    atlasFrame: atlasFrame ?? mergedPreset.atlasFrame
  };
};

export const getPresetSourceLabel = (presetKey: string): string => {
  return hasLocalSpriteAnchorPreset(presetKey)
    ? '当前配置来源：项目配置(JSON)'
    : '当前配置来源：默认模板（尚未写入 JSON）';
};
