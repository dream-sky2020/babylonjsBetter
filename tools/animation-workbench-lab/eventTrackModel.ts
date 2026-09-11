import type { AnimationEventMarker } from '../../core/animation/preset/animationScenePreset.ts';

export const snapEventTime = (time: number, framesPerSecond: number | null) => {
  if (!framesPerSecond || framesPerSecond <= 0) return time;
  return Math.round(time * framesPerSecond) / framesPerSecond;
};

export const moveAnimationEvent = (
  events: readonly AnimationEventMarker[],
  eventId: string,
  time: number,
  duration: number,
  framesPerSecond: number | null,
) => events.map(marker => marker.id === eventId
  ? { ...marker, time: Math.min(duration, Math.max(0, snapEventTime(time, framesPerSecond))) }
  : marker).sort((left, right) => left.time - right.time);

export const deleteAnimationEvent = (events: readonly AnimationEventMarker[], eventId: string) =>
  events.filter(marker => marker.id !== eventId);

export const eventsCrossed = (
  events: readonly AnimationEventMarker[],
  previousTime: number,
  currentTime: number,
  looped: boolean,
) => looped
  ? [
      ...events.filter(marker => marker.time > previousTime).sort((left, right) => left.time - right.time),
      ...events.filter(marker => marker.time <= currentTime).sort((left, right) => left.time - right.time),
    ]
  : events.filter(marker => marker.time > previousTime && marker.time <= currentTime).sort((left, right) => left.time - right.time);
