import type { SpriteDissolveEffectState } from './spriteDissolve.types.ts';

export type SpriteDissolveHost = { setDissolve: (options: SpriteDissolveEffectState) => void };
export type SpriteDissolveController = {
  setProgress: (progress: number) => void;
  updateOptions: (options: SpriteDissolveEffectState) => void;
  reset: () => void;
};

export const createSpriteDissolveController = (
  host: SpriteDissolveHost,
  initialOptions: SpriteDissolveEffectState
): SpriteDissolveController => {
  let options = { ...initialOptions, enabled: true, progress: initialOptions.progress ?? 0 };
  const apply = () => host.setDissolve(options);
  apply();
  return {
    setProgress: (progress) => {
      options = { ...options, progress: Math.max(0, Math.min(1, progress)) };
      apply();
    },
    updateOptions: (next) => { options = { ...options, ...next }; apply(); },
    reset: () => host.setDissolve({ ...options, enabled: false, progress: 0 })
  };
};
