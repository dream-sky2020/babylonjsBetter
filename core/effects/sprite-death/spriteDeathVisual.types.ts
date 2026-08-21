export type SpriteDeathVisualRuntime = {
  setProgress: (progress: number) => void;
  update: (timeSec: number) => void;
  dispose: () => void;
};
