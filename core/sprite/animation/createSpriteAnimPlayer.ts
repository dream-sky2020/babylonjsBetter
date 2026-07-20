import type { CompositeSprite } from '@/core/sprite/composition/createCompositeSprite.ts';
import {
  evaluateSpriteAnimClip,
  getClipDuration
} from '@/core/sprite/animation/evaluateSpriteAnimClip.ts';
import type { SpriteAnimClip } from '@/core/sprite/types/sprite-animation.types.ts';

export type SpriteAnimPlayerState = 'stopped' | 'playing' | 'paused';

export type SpriteAnimPlayer = {
  clip: SpriteAnimClip;
  getState: () => SpriteAnimPlayerState;
  getTime: () => number;
  getDuration: () => number;
  play: () => void;
  pause: () => void;
  stop: () => void;
  seek: (timeSec: number) => void;
  setClip: (clip: SpriteAnimClip, seekToStart?: boolean) => void;
  /** 推进时间并应用到组合体；返回当前时间 */
  update: (deltaSec: number) => number;
  dispose: () => void;
};

export const createSpriteAnimPlayer = (
  composite: CompositeSprite,
  clip: SpriteAnimClip
): SpriteAnimPlayer => {
  let currentClip = clip;
  let state: SpriteAnimPlayerState = 'stopped';
  let time = 0;
  let disposed = false;

  const applyAt = (nextTime: number) => {
    if (disposed) return;
    time = nextTime;
    // 先回到绑定姿势再叠动画，避免 scrub 时残留上一帧字段
    composite.resetToBindPose();
    composite.applyPoseMap(evaluateSpriteAnimClip(currentClip, time));
  };

  return {
    get clip() {
      return currentClip;
    },
    getState: () => state,
    getTime: () => time,
    getDuration: () => getClipDuration(currentClip),
    play: () => {
      if (disposed) return;
      state = 'playing';
    },
    pause: () => {
      if (disposed) return;
      if (state === 'playing') state = 'paused';
    },
    stop: () => {
      if (disposed) return;
      state = 'stopped';
      applyAt(0);
    },
    seek: (timeSec) => {
      if (disposed) return;
      // scrub/seek 不做 loop 取模，否则 duration 末帧会被卷回 0
      const duration = getClipDuration(currentClip);
      const next = Math.max(0, Math.min(timeSec, Math.max(duration, 0)));
      applyAt(next);
    },
    setClip: (nextClip, seekToStart = true) => {
      if (disposed) return;
      currentClip = nextClip;
      if (seekToStart) {
        applyAt(0);
      } else {
        applyAt(time);
      }
    },
    update: (deltaSec) => {
      if (disposed) return time;
      if (state !== 'playing') return time;

      const duration = getClipDuration(currentClip);
      let next = time + Math.max(0, deltaSec);

      if (currentClip.loop && duration > 0) {
        // 播放循环：落到 duration 时回到 0
        if (next >= duration) {
          next = next % duration;
        }
      } else if (duration > 0 && next >= duration) {
        next = duration;
        state = 'stopped';
      }

      applyAt(next);
      return time;
    },
    dispose: () => {
      disposed = true;
      state = 'stopped';
    }
  };
};
