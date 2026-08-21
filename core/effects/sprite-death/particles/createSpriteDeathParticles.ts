import { Mesh, ParticleSystem, Scene, Texture, Vector3 } from '@babylonjs/core';
import type { SpriteAshPreset, SpriteDissolveParticleMode } from '@/core/sprite/ash/spriteAsh.types.ts';
import { configureAshParticles } from '@/core/effects/sprite-death/particles/ashParticles.ts';
import { configureEmberParticles } from '@/core/effects/sprite-death/particles/emberParticles.ts';
import { configureBlackShardParticles } from '@/core/effects/sprite-death/particles/blackShardParticles.ts';
import { configurePixelParticles } from '@/core/effects/sprite-death/particles/pixelParticles.ts';
import type { SpriteDeathParticleProfile } from '@/core/effects/sprite-death/particles/particleProfile.types.ts';
import { rotateParticleMotion } from '@/core/effects/sprite-death/particles/particleProfile.types.ts';

const PARTICLE_MODES = new Set<SpriteDissolveParticleMode>(['ash', 'blackShards', 'embers', 'pixel']);
const PARTICLE_PROFILES: Partial<Record<SpriteDissolveParticleMode, SpriteDeathParticleProfile>> = {
  ash: configureAshParticles,
  blackShards: configureBlackShardParticles,
  embers: configureEmberParticles,
  pixel: configurePixelParticles
};

export type SpriteDeathParticleController = {
  setPreset: (preset: SpriteAshPreset) => void;
  setProgress: (progress: number) => void;
  setDisplayScale: (scale: number) => void;
  updateTime: (time: number) => void;
  dispose: () => void;
};

export const createSpriteDeathParticles = (
  scene: Scene,
  parent: Mesh,
  initialPreset: SpriteAshPreset
): SpriteDeathParticleController => {
  const emitter = new Mesh('spriteDissolveEdgeEmitter', scene);
  emitter.parent = parent;
  emitter.isVisible = false;

  const system = new ParticleSystem('spriteDissolveParticles', 900, scene);
  const particleTexture = new Texture('/resources/particle_white.svg', scene, false, true, Texture.BILINEAR_SAMPLINGMODE);
  particleTexture.hasAlpha = true;
  system.particleTexture = particleTexture;
  system.emitter = emitter;
  system.minEmitBox = new Vector3(-.52, -.018, -.015);
  system.maxEmitBox = new Vector3(.52, .018, .015);
  system.updateSpeed = .012;
  system.start();

  let preset = initialPreset;
  let progress = 0;
  let displayScale = 5;
  let time = 0;
  let lastMotionTime = -1;

  const applySize = () => {
    const unit = Math.max(.025, displayScale * .022);
    if (preset.particleMode === 'blackShards') {
      system.minSize = unit * preset.particleSizeMin; system.maxSize = unit * preset.particleSizeMax;
      system.minScaleX = .6; system.maxScaleX = 1.8; system.minScaleY = .25; system.maxScaleY = .65;
    } else if (preset.particleMode === 'embers') {
      system.minSize = unit * preset.particleSizeMin; system.maxSize = unit * preset.particleSizeMax;
      system.minScaleX = .55; system.maxScaleX = 1.25; system.minScaleY = .55; system.maxScaleY = 1.25;
    } else if (preset.particleMode === 'ash') {
      system.minSize = unit * preset.particleSizeMin; system.maxSize = unit * preset.particleSizeMax;
      system.minScaleX = .45; system.maxScaleX = 1.1; system.minScaleY = .45; system.maxScaleY = 1.25;
    } else {
      system.minSize = unit * preset.particleSizeMin; system.maxSize = unit * preset.particleSizeMax;
      system.minScaleX = .85; system.maxScaleX = 1.15; system.minScaleY = .85; system.maxScaleY = 1.15;
    }
  };

  const applyPreset = () => {
    const angle = preset.directionAngleDeg * Math.PI / 180;
    emitter.rotation.z = angle - Math.PI / 2;
    const profile = PARTICLE_PROFILES[preset.particleMode];
    profile?.(system, preset, system.minEmitBox, system.maxEmitBox);
    system.minLifeTime = Math.min(preset.particleLifeMin, preset.particleLifeMax);
    system.maxLifeTime = Math.max(preset.particleLifeMin, preset.particleLifeMax);
    system.minEmitPower = Math.min(preset.particlePowerMin, preset.particlePowerMax);
    system.maxEmitPower = Math.max(preset.particlePowerMin, preset.particlePowerMax);
    system.gravity.copyFrom(rotateParticleMotion(
      new Vector3(preset.particleGravityX, preset.particleGravityY, preset.particleGravityZ),
      preset.directionAngleDeg
    ));
    system.minAngularSpeed = Math.min(preset.particleAngularSpeedMin, preset.particleAngularSpeedMax);
    system.maxAngularSpeed = Math.max(preset.particleAngularSpeedMin, preset.particleAngularSpeedMax);
    applySize();
    system.emitRate = 0;
  };

  const controller: SpriteDeathParticleController = {
    setPreset: (next) => {
      const changed = next.particleMode !== preset.particleMode;
      preset = next;
      if (changed) system.reset();
      applyPreset();
    },
    setProgress: (next) => {
      const value = Math.max(0, Math.min(1, next));
      const movedForward = value > progress + .00001;
      if (value < progress || value <= .001) system.reset();
      progress = value;
      const angle = preset.directionAngleDeg * Math.PI / 180;
      const edge = value - .5;
      emitter.position.set(Math.cos(angle) * edge, Math.sin(angle) * edge, -.01);
      const start = Math.min(preset.particleStartProgress, preset.particleEndProgress - .001);
      const end = Math.max(start + .001, preset.particleEndProgress);
      if (PARTICLE_MODES.has(preset.particleMode) && movedForward && value >= start && value < end) {
        lastMotionTime = time;
        const localProgress = Math.max(0, Math.min(1, (value - start) / (end - start)));
        system.emitRate = preset.particleRate * Math.pow(Math.sin(Math.PI * localProgress), preset.particleRatePower);
      }
    },
    setDisplayScale: (next) => { displayScale = Math.max(.1, next); applySize(); },
    updateTime: (next) => {
      time = next;
      if (lastMotionTime >= 0 && time - lastMotionTime > .08) system.emitRate = 0;
    },
    dispose: () => { system.dispose(); particleTexture.dispose(); emitter.dispose(); }
  };

  applyPreset();
  return controller;
};
