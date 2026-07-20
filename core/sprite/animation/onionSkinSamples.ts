import { getClipDuration } from '@/core/sprite/animation/evaluateSpriteAnimClip.ts';
import type { SpriteAnimClip } from '@/core/sprite/types/sprite-animation.types.ts';

export type OnionSkinMode = 'time' | 'keyframe';

export type OnionSkinSettings = {
  enabled: boolean;
  mode: OnionSkinMode;
  /** 模式一：固定采样间隔（秒），例如 1/30 ≈ 0.0333 */
  intervalSec: number;
  /** 过去方向采样次数 */
  pastCount: number;
  /** 未来方向采样次数 */
  futureCount: number;
};

export type OnionSkinSample = {
  /** 落在时间轴上的实际时间（已处理循环） */
  time: number;
  /** past = 红色残影，future = 蓝色残影 */
  direction: 'past' | 'future';
  /** 距当前第几档（1 最近） */
  index: number;
  /** 残影不透明度 */
  alpha: number;
};

export const DEFAULT_ONION_SKIN_SETTINGS: OnionSkinSettings = {
  enabled: false,
  mode: 'time',
  intervalSec: 1 / 30,
  pastCount: 3,
  futureCount: 3
};

const TIME_EPS = 1e-4;

const wrapTime = (raw: number, duration: number, loop: boolean): number | null => {
  if (!(duration > 0)) return null;
  if (loop) {
    return ((raw % duration) + duration) % duration;
  }
  if (raw < -TIME_EPS || raw > duration + TIME_EPS) return null;
  return Math.max(0, Math.min(duration, raw));
};

const alphaForIndex = (index: number, count: number): number => {
  const maxAlpha = 0.42;
  const minAlpha = 0.07;
  if (count <= 1) return maxAlpha;
  const t = (index - 1) / (count - 1);
  return maxAlpha - (maxAlpha - minAlpha) * t;
};

/**
 * 计算洋葱皮采样点。
 * - 循环开启时：未来可来自时间轴前段，过去可来自末段
 * - 循环关闭时：超出 [0, duration] 的采样丢弃
 */
export const computeOnionSkinSamples = (
  clip: SpriteAnimClip,
  currentTime: number,
  settings: OnionSkinSettings
): OnionSkinSample[] => {
  if (!settings.enabled) return [];

  const duration = getClipDuration(clip);
  if (!(duration > 0)) return [];

  const pastCount = Math.max(0, Math.floor(settings.pastCount));
  const futureCount = Math.max(0, Math.floor(settings.futureCount));
  if (pastCount === 0 && futureCount === 0) return [];

  const samples: OnionSkinSample[] = [];
  const pushSample = (time: number, direction: 'past' | 'future', index: number, count: number) => {
    if (Math.abs(time - currentTime) < TIME_EPS) return;
    samples.push({
      time,
      direction,
      index,
      alpha: alphaForIndex(index, count)
    });
  };

  if (settings.mode === 'time') {
    const step = Math.max(0.001, settings.intervalSec);
    for (let i = 1; i <= pastCount; i += 1) {
      const wrapped = wrapTime(currentTime - i * step, duration, clip.loop);
      if (wrapped === null) continue;
      pushSample(wrapped, 'past', i, pastCount);
    }
    for (let i = 1; i <= futureCount; i += 1) {
      const wrapped = wrapTime(currentTime + i * step, duration, clip.loop);
      if (wrapped === null) continue;
      pushSample(wrapped, 'future', i, futureCount);
    }
    return samples;
  }

  // keyframe mode：沿播放方向吸附到真实关键帧
  const keyTimes = [...new Set(clip.keys.map((key) => key.time))]
    .filter((time) => Number.isFinite(time))
    .sort((a, b) => a - b);
  if (keyTimes.length === 0) return samples;

  type Candidate = { time: number; forward: number; backward: number };
  const candidates: Candidate[] = [];

  for (const keyTime of keyTimes) {
    if (Math.abs(keyTime - currentTime) < TIME_EPS) continue;

    if (clip.loop) {
      let forward = keyTime - currentTime;
      if (forward < 0) forward += duration;
      let backward = currentTime - keyTime;
      if (backward < 0) backward += duration;
      // 同一关键帧不会同时算过去和未来：取更近的一侧
      candidates.push({ time: keyTime, forward, backward });
    } else {
      candidates.push({
        time: keyTime,
        forward: keyTime > currentTime + TIME_EPS ? keyTime - currentTime : Number.POSITIVE_INFINITY,
        backward:
          keyTime < currentTime - TIME_EPS ? currentTime - keyTime : Number.POSITIVE_INFINITY
      });
    }
  }

  const past = candidates
    .filter((item) => item.backward < Number.POSITIVE_INFINITY && item.backward > TIME_EPS)
    .filter((item) => !clip.loop || item.backward <= item.forward)
    .sort((a, b) => a.backward - b.backward)
    .slice(0, pastCount);

  const future = candidates
    .filter((item) => item.forward < Number.POSITIVE_INFINITY && item.forward > TIME_EPS)
    .filter((item) => !clip.loop || item.forward < item.backward)
    .sort((a, b) => a.forward - b.forward)
    .slice(0, futureCount);

  past.forEach((item, index) => {
    pushSample(item.time, 'past', index + 1, pastCount);
  });
  future.forEach((item, index) => {
    pushSample(item.time, 'future', index + 1, futureCount);
  });

  return samples;
};
