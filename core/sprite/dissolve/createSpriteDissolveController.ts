import type { SpriteNoiseErodeOptions } from '@/core/sprite/shader/modules/noiseErode.module.ts';

export type SpriteDissolveHost = { setNoiseErode: (options: SpriteNoiseErodeOptions) => void };
export type SpriteDissolveController = {
  setProgress: (progress: number) => void;
  updateOptions: (options: SpriteNoiseErodeOptions) => void;
  reset: () => void;
};

export const createSpriteDissolveController = (
  host: SpriteDissolveHost,
  initialOptions: SpriteNoiseErodeOptions
): SpriteDissolveController => {
  let options = { ...initialOptions, enabled: true, progress: initialOptions.progress ?? 0 };
  const apply = () => host.setNoiseErode(options);
  apply();
  return {
    setProgress: (progress) => {
      options = { ...options, progress: Math.max(0, Math.min(1, progress)) };
      apply();
    },
    updateOptions: (next) => { options = { ...options, ...next }; apply(); },
    reset: () => host.setNoiseErode({ enabled: false, progress: 0 })
  };
};
