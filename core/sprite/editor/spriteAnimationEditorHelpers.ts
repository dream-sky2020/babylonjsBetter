import {
  DEFAULT_SPRITE_TRANSFORM,
  type SpriteAnimClip,
  type SpriteAnimKeyframe,
  type SpritePartDef,
  type SpritePartPose,
  type SpriteRigDef
} from '@/core/sprite/types/sprite-animation.types.ts';
import {
  DEFAULT_SCANNED_ATLAS_OPTIONS,
  joinPublicPath,
  normalizePublicPath
} from '@/core/sprite/editor/spriteAnchorEditorHelpers.ts';

export const SPRITE_ANIM_LAST_RIG_KEY = 'sprite-animation-editor.last-rig-id';
export const SPRITE_ANIM_LAST_CLIP_KEY = 'sprite-animation-editor.last-clip-id';
export const SPRITE_ANIM_DEFAULT_ORTHO_SIZE = 5;
export const SPRITE_ANIM_MIN_ORTHO_SIZE = 1.5;
export const SPRITE_ANIM_MAX_ORTHO_SIZE = 14;
export const SPRITE_ANIM_ZOOM_STEP = 0.1;

export { DEFAULT_SCANNED_ATLAS_OPTIONS, joinPublicPath, normalizePublicPath };

export const getLastAnimRigId = (): string | null => {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(SPRITE_ANIM_LAST_RIG_KEY);
  } catch {
    return null;
  }
};

export const saveLastAnimRigId = (rigId: string): void => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(SPRITE_ANIM_LAST_RIG_KEY, rigId);
  } catch {
    // ignore
  }
};

export const getLastAnimClipId = (): string | null => {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(SPRITE_ANIM_LAST_CLIP_KEY);
  } catch {
    return null;
  }
};

export const saveLastAnimClipId = (clipId: string): void => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(SPRITE_ANIM_LAST_CLIP_KEY, clipId);
  } catch {
    // ignore
  }
};

export const createEmptyPart = (
  partId: string,
  frameName?: string,
  atlas?: { atlasJsonPath?: string; atlasImagePath?: string }
): SpritePartDef => ({
  partId,
  label: partId,
  atlasJsonPath: atlas?.atlasJsonPath,
  atlasImagePath: atlas?.atlasImagePath,
  defaultFrameName: frameName,
  transform: { ...DEFAULT_SPRITE_TRANSFORM },
  zIndex: 0
});

export const createEmptyRig = (
  rigId: string,
  atlasJsonPath: string,
  atlasImagePath: string,
  firstFrameName?: string
): SpriteRigDef => ({
  rigId,
  name: rigId,
  atlasJsonPath: normalizePublicPath(atlasJsonPath),
  atlasImagePath: normalizePublicPath(atlasImagePath),
  baseSize: 2.5,
  parts: [createEmptyPart('part_1', firstFrameName)]
});

export const createEmptyClip = (clipId: string, rigId: string, partIds: string[]): SpriteAnimClip => {
  const parts: Record<string, SpritePartPose> = {};
  for (const partId of partIds) {
    parts[partId] = { x: 0, y: 0, rotationDeg: 0, scaleX: 1, scaleY: 1, visible: true };
  }
  return {
    clipId,
    rigId,
    name: clipId.includes('/') ? clipId.split('/').pop() : clipId,
    fps: 12,
    duration: 1,
    loop: true,
    keys: [{ time: 0, parts }]
  };
};

export const upsertKeyframe = (
  clip: SpriteAnimClip,
  time: number,
  partId: string,
  pose: SpritePartPose
): SpriteAnimClip => {
  const keys = [...clip.keys];
  const rounded = Number(time.toFixed(4));
  const existingIndex = keys.findIndex((key) => Math.abs(key.time - rounded) < 1e-4);
  if (existingIndex >= 0) {
    keys[existingIndex] = {
      ...keys[existingIndex],
      parts: {
        ...keys[existingIndex].parts,
        [partId]: {
          ...keys[existingIndex].parts[partId],
          ...pose
        }
      }
    };
  } else {
    keys.push({
      time: rounded,
      parts: { [partId]: pose }
    });
  }
  keys.sort((a, b) => a.time - b.time);
  return { ...clip, keys };
};

export const removeKeyframeAt = (clip: SpriteAnimClip, time: number): SpriteAnimClip => {
  const keys = clip.keys.filter((key) => Math.abs(key.time - time) >= 1e-4);
  return { ...clip, keys: keys.length > 0 ? keys : [{ time: 0, parts: {} }] };
};

export const removeKeyframesAt = (clip: SpriteAnimClip, times: number[]): SpriteAnimClip => {
  let next = clip;
  for (const time of times) {
    next = removeKeyframeAt(next, time);
  }
  return next;
};

/** 移动单个关键帧时间；若目标时间已有关键帧则合并 parts */
export const moveKeyframeTime = (
  clip: SpriteAnimClip,
  fromTime: number,
  toTime: number
): SpriteAnimClip => {
  const roundedTo = Number(Math.max(0, toTime).toFixed(4));
  const fromIndex = clip.keys.findIndex((key) => Math.abs(key.time - fromTime) < 1e-4);
  if (fromIndex < 0) return clip;
  if (Math.abs(roundedTo - fromTime) < 1e-4) return clip;

  const moving = clip.keys[fromIndex];
  const rest = clip.keys.filter((_, index) => index !== fromIndex);
  const targetIndex = rest.findIndex((key) => Math.abs(key.time - roundedTo) < 1e-4);

  let keys: SpriteAnimKeyframe[];
  if (targetIndex >= 0) {
    keys = rest.map((key, index) =>
      index === targetIndex
        ? {
            time: roundedTo,
            parts: { ...key.parts, ...moving.parts }
          }
        : key
    );
  } else {
    keys = [...rest, { ...moving, time: roundedTo }];
  }
  keys.sort((a, b) => a.time - b.time);
  return { ...clip, keys };
};

/** 批量平移选中关键帧时间（保持相对间距） */
export const shiftKeyframesTime = (
  clip: SpriteAnimClip,
  times: number[],
  deltaSec: number
): SpriteAnimClip => {
  if (times.length === 0 || Math.abs(deltaSec) < 1e-8) return clip;
  const selected = new Set(times.map((t) => Number(t.toFixed(4))));
  const moved = clip.keys.map((key) => {
    const rounded = Number(key.time.toFixed(4));
    if (!selected.has(rounded)) return key;
    return { ...key, time: Number(Math.max(0, key.time + deltaSec).toFixed(4)) };
  });

  // 合并同时间戳
  const merged = new Map<number, SpriteAnimKeyframe>();
  for (const key of moved) {
    const t = Number(key.time.toFixed(4));
    const existing = merged.get(t);
    if (!existing) {
      merged.set(t, { time: t, parts: { ...key.parts } });
    } else {
      merged.set(t, { time: t, parts: { ...existing.parts, ...key.parts } });
    }
  }
  return {
    ...clip,
    keys: [...merged.values()].sort((a, b) => a.time - b.time)
  };
};

export const samplePoseFromKeyframe = (
  key: SpriteAnimKeyframe | undefined,
  partId: string
): SpritePartPose => {
  return key?.parts[partId] ? { ...key.parts[partId] } : {};
};

export const toFixedNumber = (value: number, digits = 4): number =>
  Number(value.toFixed(digits));

export const upsertPoseChannel = (
  clip: SpriteAnimClip,
  time: number,
  partId: string,
  channel: 'x' | 'y' | 'rotationDeg' | 'scaleX' | 'scaleY',
  value: number
): SpriteAnimClip => {
  return upsertKeyframe(clip, time, partId, { [channel]: value });
};
