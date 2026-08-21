import type { Mesh, Scene } from '@babylonjs/core';
import type { MonsterDeathParameterValues, MonsterDeathVisualDefinition } from '@/core/monster-death-motion/types.ts';
import { createSpriteDeathParticles } from './particles/createSpriteDeathParticles.ts';
import { createSpriteDissolveController, type SpriteDissolveHost } from '@/core/sprite/dissolve/createSpriteDissolveController.ts';
import { createSpriteDeathParticlePreset, createSpriteDissolveOptions, resolveSpriteDissolveProgress } from '@/core/sprite/dissolve/spriteDissolvePreset.ts';
import type { SpriteDeathVisualRuntime } from './spriteDeathVisual.types.ts';

export type CreateSpriteDeathVisualRuntimeOptions = {
  scene: Scene;
  host: SpriteDissolveHost;
  emitterMesh: Mesh | null;
  visual: MonsterDeathVisualDefinition;
  parameters: MonsterDeathParameterValues;
  duration: number;
};

export const createSpriteDeathVisualRuntime = (options: CreateSpriteDeathVisualRuntimeOptions): SpriteDeathVisualRuntime => {
  const dissolve = createSpriteDissolveController(options.host, createSpriteDissolveOptions(options.visual, options.parameters));
  const particles = options.visual.particles && options.emitterMesh
    ? createSpriteDeathParticles(options.scene, options.emitterMesh, createSpriteDeathParticlePreset(options.visual, options.parameters, options.duration))
    : null;
  particles?.setDisplayScale(2.8);
  return {
    setProgress: (progress) => {
      const dissolveProgress = resolveSpriteDissolveProgress(progress, options.parameters);
      dissolve.setProgress(dissolveProgress);
      const particleStart = options.visual.particles?.startProgress ?? 0;
      const particleEnd = options.visual.particles?.endProgress ?? 1;
      const particleProgress = Math.max(0, Math.min(1, (progress - particleStart) / Math.max(.001, particleEnd - particleStart)));
      particles?.setProgress(particleProgress);
    },
    update: (timeSec) => particles?.updateTime(timeSec),
    dispose: () => { dissolve.reset(); particles?.dispose(); }
  };
};
