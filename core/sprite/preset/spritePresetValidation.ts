import type {
  NormalizedUv,
  SpriteAnchorPreset,
  SpriteAnchorPresetMap,
  SpriteAtlasFrameMeta
} from '@/core/sprite/types/sprite-anchors.types.ts';
import {
  normalizeTexturePath,
  resolvePresetIdentity,
  toSpritePresetKey
} from '@/core/sprite/preset/spritePresetKeys.ts';

const ANCHOR_MIN = -1;
const ANCHOR_MAX = 2;

export type SpritePresetValidationReport = {
  reachable: boolean;
  valid: boolean;
  errors: string[];
  message?: string;
  port?: number;
};

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));
const clampAnchor = (value: number): number => Math.max(ANCHOR_MIN, Math.min(ANCHOR_MAX, value));
const toFinite = (value: number, fallback: number): number => (Number.isFinite(value) ? value : fallback);
const toFiniteInt = (value: number, fallback: number): number => {
  const finite = toFinite(value, fallback);
  return Math.max(0, Math.round(finite));
};

const sanitizeAnchorUv = (uv: NormalizedUv, fallback: NormalizedUv): NormalizedUv => ({
  u: clampAnchor(toFinite(uv.u, fallback.u)),
  v: clampAnchor(toFinite(uv.v, fallback.v))
});

const isObject = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null;
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

export const createDefaultPreset = (
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

export const sanitizePreset = (preset: SpriteAnchorPreset): SpriteAnchorPreset => {
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

export const parsePresetMap = (raw: unknown): SpriteAnchorPresetMap => {
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
