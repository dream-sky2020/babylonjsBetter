import type { RuntimeDataListener } from '../runtime';

export type PlayTimeSeconds = number;

export type GameTimeController = {
  readonly running: boolean;
  readPlayTime(): PlayTimeSeconds;
  start(): void;
  pause(): void;
  reset(): void;
  update(deltaSeconds: number): void;
  subscribe(listener: RuntimeDataListener<PlayTimeSeconds>): () => void;
};