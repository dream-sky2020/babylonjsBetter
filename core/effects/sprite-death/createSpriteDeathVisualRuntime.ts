import type { Mesh, Scene } from '@babylonjs/core';
import type { MonsterDeathParameterValues, MonsterDeathVisualDefinition } from '@/core/monster-death-motion/types.ts';
import { createSpriteDeathParticles } from './particles/createSpriteDeathParticles.ts';
import { createSpriteDissolveController, type SpriteDissolveHost } from '@/core/sprite/dissolve/createSpriteDissolveController.ts';
import { createSpriteDeathParticlePreset, createSpriteDissolveOptions, resolveSpriteDissolveProgress } from '@/core/sprite/dissolve/spriteDissolvePreset.ts';
import { applyMonsterDissolve, type MonsterDissolvePreset, type MonsterDissolveTarget } from '@/core/monster/dissolve/monsterDissolve';
import type { SpriteDeathVisualRuntime } from './spriteDeathVisual.types.ts';

export type CreateSpriteDeathVisualRuntimeOptions = {
  scene: Scene;
  host: SpriteDissolveHost & Partial<MonsterDissolveTarget>;
  monsterPreset?: MonsterDissolvePreset;
  emitterMesh: Mesh | null;
  visual: MonsterDeathVisualDefinition;
  parameters: MonsterDeathParameterValues;
  duration: number;
};

export const createSpriteDeathVisualRuntime = (options: CreateSpriteDeathVisualRuntimeOptions): SpriteDeathVisualRuntime => {
  const preset = options.monsterPreset;
  const layered = preset && options.host.setLayerDissolve && options.host.setLayerOpacity ? options.host as SpriteDissolveHost & MonsterDissolveTarget : null;
  const dissolve = layered ? null : createSpriteDissolveController(options.host, createSpriteDissolveOptions(options.visual, options.parameters));
  const particles = options.emitterMesh && (preset ? preset.particleMode !== 'none' : !!options.visual.particles)
    ? createSpriteDeathParticles(options.scene, options.emitterMesh, preset ?? createSpriteDeathParticlePreset(options.visual, options.parameters, options.duration))
    : null;
  particles?.setDisplayScale(2.8);
  return {
    setProgress: (progress) => {
      const dissolveProgress = resolveSpriteDissolveProgress(progress, options.parameters);
      if (layered && preset) applyMonsterDissolve(layered, preset, progress); else dissolve?.setProgress(dissolveProgress);
      const particleStart = options.visual.particles?.startProgress ?? 0;
      const particleEnd = options.visual.particles?.endProgress ?? 1;
      const particleProgress = Math.max(0, Math.min(1, (progress - particleStart) / Math.max(.001, particleEnd - particleStart)));
      particles?.setProgress(preset ? progress : particleProgress);
    },
    update: (timeSec) => particles?.updateTime(timeSec),
    dispose: () => { if (layered && preset) applyMonsterDissolve(layered, preset, 0, false); else dissolve?.reset(); particles?.dispose(); }
  };
};
