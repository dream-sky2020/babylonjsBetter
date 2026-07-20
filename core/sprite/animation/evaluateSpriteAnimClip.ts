import type {
  SpriteAnimClip,
  SpriteAnimKeyframe,
  SpritePartPose
} from '@/core/sprite/types/sprite-animation.types.ts';

const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

const lerpOptional = (
  a: number | undefined,
  b: number | undefined,
  t: number
): number | undefined => {
  if (a === undefined && b === undefined) return undefined;
  if (a === undefined) return b;
  if (b === undefined) return a;
  return lerp(a, b, t);
};

export const getClipDuration = (clip: SpriteAnimClip): number => {
  if (typeof clip.duration === 'number' && Number.isFinite(clip.duration) && clip.duration > 0) {
    return clip.duration;
  }
  if (clip.keys.length === 0) return 0;
  return Math.max(...clip.keys.map((key) => key.time), 0);
};

const sortKeys = (keys: SpriteAnimKeyframe[]): SpriteAnimKeyframe[] =>
  [...keys].sort((a, b) => a.time - b.time);

/**
 * 在给定时间求值：变换线性插值，frameName / visible 使用阶跃（取左关键帧）。
 */
export const evaluateSpriteAnimClip = (
  clip: SpriteAnimClip,
  timeSec: number
): Record<string, SpritePartPose> => {
  const keys = sortKeys(clip.keys);
  if (keys.length === 0) return {};

  const duration = getClipDuration(clip);
  let t = timeSec;
  if (clip.loop && duration > 0) {
    t = ((t % duration) + duration) % duration;
  } else {
    t = Math.max(0, Math.min(t, duration));
  }

  if (t <= keys[0].time) {
    return { ...keys[0].parts };
  }

  const last = keys[keys.length - 1];
  if (t >= last.time) {
    return { ...last.parts };
  }

  let left = keys[0];
  let right = keys[1];
  for (let i = 0; i < keys.length - 1; i += 1) {
    if (t >= keys[i].time && t <= keys[i + 1].time) {
      left = keys[i];
      right = keys[i + 1];
      break;
    }
  }

  const span = Math.max(1e-6, right.time - left.time);
  const alpha = (t - left.time) / span;
  const partIds = new Set([...Object.keys(left.parts), ...Object.keys(right.parts)]);
  const result: Record<string, SpritePartPose> = {};

  for (const partId of partIds) {
    const a = left.parts[partId] ?? {};
    const b = right.parts[partId] ?? {};
    result[partId] = {
      frameName: a.frameName ?? b.frameName,
      visible: a.visible ?? b.visible,
      x: lerpOptional(a.x, b.x, alpha),
      y: lerpOptional(a.y, b.y, alpha),
      rotationDeg: lerpOptional(a.rotationDeg, b.rotationDeg, alpha),
      scaleX: lerpOptional(a.scaleX, b.scaleX, alpha),
      scaleY: lerpOptional(a.scaleY, b.scaleY, alpha)
    };
  }

  return result;
};
