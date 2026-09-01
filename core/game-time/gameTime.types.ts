import type { RuntimeDataListener } from '../runtime';

export type PlayTimeSecondsData = {
  playTimeSeconds: number;
};

export type GameTimeController = {
  readonly running: boolean;
  readPlayTime(): PlayTimeSecondsData;
  start(): void;
  pause(): void;
  reset(): void;
  update(deltaSeconds: number): void;
  subscribe(listener: RuntimeDataListener<PlayTimeSecondsData>): () => void;
};