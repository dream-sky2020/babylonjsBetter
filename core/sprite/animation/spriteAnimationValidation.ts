import {
  DEFAULT_SPRITE_TRANSFORM,
  type SpriteAnimClip,
  type SpriteAnimKeyframe,
  type SpriteAnimationLibrary,
  type SpritePartDef,
  type SpritePartPose,
  type SpriteRigDef,
  type SpriteTransform2D
} from '@/core/sprite/types/sprite-animation.types.ts';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const asFiniteNumber = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) ? value : null;

const sanitizeTransform = (raw: unknown): SpriteTransform2D => {
  if (!isRecord(raw)) return { ...DEFAULT_SPRITE_TRANSFORM };
  return {
    x: asFiniteNumber(raw.x) ?? DEFAULT_SPRITE_TRANSFORM.x,
    y: asFiniteNumber(raw.y) ?? DEFAULT_SPRITE_TRANSFORM.y,
    rotationDeg: asFiniteNumber(raw.rotationDeg) ?? DEFAULT_SPRITE_TRANSFORM.rotationDeg,
    scaleX: asFiniteNumber(raw.scaleX) ?? DEFAULT_SPRITE_TRANSFORM.scaleX,
    scaleY: asFiniteNumber(raw.scaleY) ?? DEFAULT_SPRITE_TRANSFORM.scaleY
  };
};

const sanitizePose = (raw: unknown): SpritePartPose => {
  if (!isRecord(raw)) return {};
  const pose: SpritePartPose = {};
  if (typeof raw.frameName === 'string') pose.frameName = raw.frameName;
  if (asFiniteNumber(raw.x) !== null) pose.x = asFiniteNumber(raw.x)!;
  if (asFiniteNumber(raw.y) !== null) pose.y = asFiniteNumber(raw.y)!;
  if (asFiniteNumber(raw.rotationDeg) !== null) pose.rotationDeg = asFiniteNumber(raw.rotationDeg)!;
  if (asFiniteNumber(raw.scaleX) !== null) pose.scaleX = asFiniteNumber(raw.scaleX)!;
  if (asFiniteNumber(raw.scaleY) !== null) pose.scaleY = asFiniteNumber(raw.scaleY)!;
  if (typeof raw.visible === 'boolean') pose.visible = raw.visible;
  return pose;
};

export const sanitizePartDef = (raw: unknown, fallbackId: string): SpritePartDef => {
  const obj = isRecord(raw) ? raw : {};
  const partId = typeof obj.partId === 'string' && obj.partId.trim() ? obj.partId.trim() : fallbackId;
  return {
    partId,
    label: typeof obj.label === 'string' ? obj.label : undefined,
    atlasJsonPath: typeof obj.atlasJsonPath === 'string' ? obj.atlasJsonPath : undefined,
    atlasImagePath: typeof obj.atlasImagePath === 'string' ? obj.atlasImagePath : undefined,
    defaultFrameName: typeof obj.defaultFrameName === 'string' ? obj.defaultFrameName : undefined,
    transform: obj.transform !== undefined ? sanitizeTransform(obj.transform) : undefined,
    zIndex: asFiniteNumber(obj.zIndex) ?? undefined
  };
};

export const sanitizeRig = (raw: unknown, fallbackId: string): SpriteRigDef => {
  const obj = isRecord(raw) ? raw : {};
  const rigId = typeof obj.rigId === 'string' && obj.rigId.trim() ? obj.rigId.trim() : fallbackId;
  const partsRaw = Array.isArray(obj.parts) ? obj.parts : [];
  return {
    rigId,
    name: typeof obj.name === 'string' ? obj.name : undefined,
    atlasJsonPath: typeof obj.atlasJsonPath === 'string' ? obj.atlasJsonPath : '',
    atlasImagePath: typeof obj.atlasImagePath === 'string' ? obj.atlasImagePath : '',
    baseSize: asFiniteNumber(obj.baseSize) ?? undefined,
    parts: partsRaw.map((part, index) => sanitizePartDef(part, `part_${index + 1}`))
  };
};

export const sanitizeClip = (raw: unknown, fallbackId: string): SpriteAnimClip => {
  const obj = isRecord(raw) ? raw : {};
  const clipId = typeof obj.clipId === 'string' && obj.clipId.trim() ? obj.clipId.trim() : fallbackId;
  const keysRaw = Array.isArray(obj.keys) ? obj.keys : [];
  const keys: SpriteAnimKeyframe[] = keysRaw
    .map((key) => {
      if (!isRecord(key)) return null;
      const time = asFiniteNumber(key.time);
      if (time === null || time < 0) return null;
      const partsObj = isRecord(key.parts) ? key.parts : {};
      const parts: Record<string, SpritePartPose> = {};
      for (const [partId, pose] of Object.entries(partsObj)) {
        parts[partId] = sanitizePose(pose);
      }
      return { time, parts };
    })
    .filter((key): key is SpriteAnimKeyframe => key !== null)
    .sort((a, b) => a.time - b.time);

  return {
    clipId,
    rigId: typeof obj.rigId === 'string' ? obj.rigId : '',
    name: typeof obj.name === 'string' ? obj.name : undefined,
    fps: asFiniteNumber(obj.fps) ?? 12,
    duration: asFiniteNumber(obj.duration) ?? undefined,
    loop: typeof obj.loop === 'boolean' ? obj.loop : true,
    keys
  };
};

export const createEmptyAnimationLibrary = (): SpriteAnimationLibrary => ({
  rigs: {},
  clips: {}
});

export const sanitizeAnimationLibrary = (raw: unknown): SpriteAnimationLibrary => {
  if (!isRecord(raw)) return createEmptyAnimationLibrary();
  const rigsRaw = isRecord(raw.rigs) ? raw.rigs : {};
  const clipsRaw = isRecord(raw.clips) ? raw.clips : {};
  const rigs: Record<string, SpriteRigDef> = {};
  const clips: Record<string, SpriteAnimClip> = {};

  for (const [key, value] of Object.entries(rigsRaw)) {
    const rig = sanitizeRig(value, key);
    rigs[rig.rigId] = rig;
  }
  for (const [key, value] of Object.entries(clipsRaw)) {
    const clip = sanitizeClip(value, key);
    clips[clip.clipId] = clip;
  }

  return { rigs, clips };
};

export type SpriteAnimationValidationReport = {
  reachable?: boolean;
  valid: boolean;
  errors: string[];
  message?: string;
  port?: number;
};

export const validateAnimationLibrary = (library: SpriteAnimationLibrary): string[] => {
  const errors: string[] = [];

  for (const [key, rig] of Object.entries(library.rigs)) {
    if (key !== rig.rigId) errors.push(`rigs[${key}].rigId 必须与 key 一致`);
    if (!rig.atlasJsonPath.trim()) errors.push(`rigs[${key}].atlasJsonPath 不能为空`);
    if (!rig.atlasImagePath.trim()) errors.push(`rigs[${key}].atlasImagePath 不能为空`);
    if (!Array.isArray(rig.parts) || rig.parts.length === 0) {
      errors.push(`rigs[${key}].parts 至少需要一个部件`);
    }
    const partIds = new Set<string>();
    for (const part of rig.parts) {
      if (!part.partId.trim()) errors.push(`rigs[${key}] 存在空 partId`);
      if (partIds.has(part.partId)) errors.push(`rigs[${key}] 重复 partId: ${part.partId}`);
      partIds.add(part.partId);
    }
  }

  for (const [key, clip] of Object.entries(library.clips)) {
    if (key !== clip.clipId) errors.push(`clips[${key}].clipId 必须与 key 一致`);
    if (!clip.rigId.trim()) errors.push(`clips[${key}].rigId 不能为空`);
    else if (!library.rigs[clip.rigId]) errors.push(`clips[${key}].rigId 引用了不存在的 rig: ${clip.rigId}`);
    if (!(clip.fps > 0)) errors.push(`clips[${key}].fps 必须大于 0`);
    if (!Array.isArray(clip.keys)) errors.push(`clips[${key}].keys 必须是数组`);
    let lastTime = -1;
    for (const keyframe of clip.keys) {
      if (!(keyframe.time >= 0)) errors.push(`clips[${key}] 存在非法 time`);
      if (keyframe.time < lastTime) errors.push(`clips[${key}].keys 必须按 time 升序`);
      lastTime = keyframe.time;
    }
  }

  return errors;
};

export const createDefaultDemoRig = (): SpriteRigDef => ({
  rigId: 'demo_xiaoren',
  name: '演示小人（可改）',
  atlasJsonPath: 'resources/小人2.json',
  atlasImagePath: 'resources/小人2.png',
  baseSize: 2.2,
  parts: [
    {
      partId: 'body',
      label: '身体',
      defaultFrameName: 'img_4749.png',
      transform: { ...DEFAULT_SPRITE_TRANSFORM },
      zIndex: 0
    },
    {
      partId: 'overlay',
      label: '叠加层',
      defaultFrameName: 'img_4750.png',
      transform: { x: 0.35, y: 0.2, rotationDeg: 0, scaleX: 0.55, scaleY: 0.55 },
      zIndex: 1
    }
  ]
});

export const createDefaultDemoClip = (rigId: string = 'demo_xiaoren'): SpriteAnimClip => ({
  clipId: `${rigId}/idle`,
  rigId,
  name: 'idle',
  fps: 8,
  duration: 1,
  loop: true,
  keys: [
    {
      time: 0,
      parts: {
        body: { frameName: 'img_4749.png', x: 0, y: 0, scaleX: 1, scaleY: 1 },
        overlay: { frameName: 'img_4750.png', x: 0.35, y: 0.2, rotationDeg: 0 }
      }
    },
    {
      time: 0.5,
      parts: {
        body: { frameName: 'img_4751.png', x: 0.05, y: -0.05, scaleX: 1.02, scaleY: 0.98 },
        overlay: { frameName: 'img_4757.png', x: 0.4, y: 0.25, rotationDeg: 12 }
      }
    },
    {
      time: 1,
      parts: {
        body: { frameName: 'img_4749.png', x: 0, y: 0, scaleX: 1, scaleY: 1 },
        overlay: { frameName: 'img_4750.png', x: 0.35, y: 0.2, rotationDeg: 0 }
      }
    }
  ]
});
