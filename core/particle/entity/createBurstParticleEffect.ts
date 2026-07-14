import {
  AbstractMesh,
  Color4,
  ParticleSystem,
  Scene,
  Texture,
  Vector3
} from '@babylonjs/core';
import type {
  ParticleController,
  ParticleEffectConfig
} from '@/core/particle/types/particle.types.ts';

const createParticleSystemName = () =>
  `burstParticles_${Date.now()}_${Math.floor(Math.random() * 10000)}`;

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

/**
 * 创建通用的“爆发型”粒子特效（受击、技能释放等）。
 */
export const createBurstParticleEffect = (
  scene: Scene,
  config: ParticleEffectConfig
): ParticleController => {
  const capacity = config.capacity ?? 100;
  const particleSystem = new ParticleSystem(createParticleSystemName(), capacity, scene);
  const autoDispose = config.autoDispose ?? true;
  const isOneShot = config.isOneShot ?? true;
  const minLifeTime = Math.max(0.01, config.minLifeTime ?? 0.3);
  const maxLifeTime = Math.max(minLifeTime, config.maxLifeTime ?? 0.8);
  const emitDuration = Math.max(0.01, config.emitDuration ?? 0.12);
  let delayTimer: number | null = null;

  particleSystem.particleTexture = new Texture(config.texturePath, scene);
  particleSystem.emitter = config.emitter;

  particleSystem.minEmitBox = config.minEmitBox ?? new Vector3(-0.2, 0, -0.2);
  particleSystem.maxEmitBox = config.maxEmitBox ?? new Vector3(0.2, 0, 0.2);
  particleSystem.minLifeTime = minLifeTime;
  particleSystem.maxLifeTime = maxLifeTime;

  if (config.colorGradients && config.colorGradients.length > 0) {
    const sortedColorGradients = [...config.colorGradients].sort((a, b) => a.offset - b.offset);
    sortedColorGradients.forEach((grad) => {
      particleSystem.addColorGradient(clamp01(grad.offset), grad.color);
    });
  } else {
    particleSystem.color1 = new Color4(1, 0.8, 0.1, 1.0);
    particleSystem.color2 = new Color4(1, 0.3, 0.1, 1.0);
    particleSystem.colorDead = new Color4(0, 0, 0, 0.0);
  }

  if (config.sizeGradients && config.sizeGradients.length > 0) {
    const sortedSizeGradients = [...config.sizeGradients].sort((a, b) => a.offset - b.offset);
    sortedSizeGradients.forEach((grad) => {
      particleSystem.addSizeGradient(clamp01(grad.offset), Math.max(0.0001, grad.size));
    });
  } else {
    particleSystem.minSize = 0.1;
    particleSystem.maxSize = 0.5;
  }

  if (config.spriteSheet) {
    const startCellId = Math.max(0, Math.round(config.spriteSheet.startCellID));
    const endCellId = Math.max(startCellId, Math.round(config.spriteSheet.endCellID));
    particleSystem.isAnimationSheetEnabled = true;
    particleSystem.spriteCellWidth = Math.max(1, Math.round(config.spriteSheet.cellWidth));
    particleSystem.spriteCellHeight = Math.max(1, Math.round(config.spriteSheet.cellHeight));
    particleSystem.startSpriteCellID = startCellId;
    particleSystem.endSpriteCellID = endCellId;
    particleSystem.spriteCellChangeSpeed = Math.max(
      1,
      Math.round(config.spriteSheet.spriteCellChangeSpeed)
    );
  }

  if (isOneShot) {
    particleSystem.manualEmitCount = capacity;
    particleSystem.targetStopDuration = emitDuration;
  } else {
    particleSystem.emitRate = Math.max(1, config.emitRate ?? 50);
  }

  particleSystem.direction1 = config.direction1 ?? new Vector3(-2, 2, -2);
  particleSystem.direction2 = config.direction2 ?? new Vector3(2, 5, 2);
  particleSystem.minEmitPower = Math.max(0.01, config.minEmitPower ?? 2);
  particleSystem.maxEmitPower = Math.max(particleSystem.minEmitPower, config.maxEmitPower ?? 5);
  particleSystem.updateSpeed = Math.max(0.0001, config.updateSpeed ?? 0.01);
  particleSystem.gravity = config.gravity ?? new Vector3(0, -9.81, 0);
  particleSystem.blendMode = ParticleSystem.BLENDMODE_ONEONE;

  if (autoDispose && isOneShot) {
    particleSystem.disposeOnStop = true;
  }

  const startNow = () => {
    particleSystem.start();
  };

  return {
    system: particleSystem,
    start: (delayMs = 0) => {
      if (delayMs <= 0) {
        startNow();
        return;
      }
      delayTimer = window.setTimeout(() => {
        delayTimer = null;
        startNow();
      }, delayMs);
    },
    stop: () => particleSystem.stop(),
    setEmitter: (newEmitter: Vector3 | AbstractMesh) => {
      particleSystem.emitter = newEmitter;
    },
    dispose: () => {
      if (delayTimer !== null) {
        window.clearTimeout(delayTimer);
        delayTimer = null;
      }
      particleSystem.dispose();
    }
  };
};

export const playBurstOneShot = (
  scene: Scene,
  texturePath: string,
  emitter: Vector3 | AbstractMesh,
  capacity = 100
): ParticleController => {
  const controller = createBurstParticleEffect(scene, {
    texturePath,
    emitter,
    capacity,
    isOneShot: true,
    autoDispose: true
  });
  controller.start();
  return controller;
};
