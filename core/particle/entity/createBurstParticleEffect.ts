import {
  AbstractMesh,
  Color4,
  Engine,
  GPUParticleSystem,
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

class OverwriteParticleSystem extends ParticleSystem {
  protected override _setEngineBasedOnBlendMode(_blendMode: number): void {
    this._engine.setAlphaMode(Engine.ALPHA_DISABLE);
  }
}

class OverwriteGPUParticleSystem extends GPUParticleSystem {
  protected override _setEngineBasedOnBlendMode(_blendMode: number): void {
    this._engine.setAlphaMode(Engine.ALPHA_DISABLE);
  }
}

/**
 * 创建通用的“爆发型”粒子特效（受击、技能释放等）。
 */
export const createBurstParticleEffect = (
  scene: Scene,
  config: ParticleEffectConfig
): ParticleController => {
  const capacity = config.capacity ?? 100;
  const overwrite = config.blendMode === 'overwrite';
  const particleSystem = GPUParticleSystem.IsSupported
    ? new (overwrite ? OverwriteGPUParticleSystem : GPUParticleSystem)(
        createParticleSystemName(),
        { capacity },
        scene,
        undefined,
        Boolean(config.spriteSheet)
      )
    : new (overwrite ? OverwriteParticleSystem : ParticleSystem)(createParticleSystemName(), capacity, scene);
  const autoDispose = config.autoDispose ?? true;
  const isOneShot = config.isOneShot ?? true;
  const minLifeTime = Math.max(0.01, config.minLifeTime ?? 0.3);
  const maxLifeTime = Math.max(minLifeTime, config.maxLifeTime ?? 0.8);
  const emitDuration = Math.max(0.01, config.emitDuration ?? 0.12);
  const configuredUpdateSpeed = Math.max(0.0001, config.updateSpeed ?? 0.01);
  let delayTimer: number | null = null;

  particleSystem.particleTexture = new Texture(config.texturePath, scene);
  particleSystem.emitter = config.emitter;

  particleSystem.minLifeTime = minLifeTime;
  particleSystem.maxLifeTime = maxLifeTime;
  const baseSize = Math.max(0.0001, config.baseSize ?? 0.1);
  const minSize = Math.max(0.0001, config.minSize ?? baseSize);
  const maxSize = Math.max(minSize, config.maxSize ?? baseSize);
  particleSystem.minSize = minSize;
  particleSystem.maxSize = maxSize;

  const baseColor = config.baseColor ?? new Color4(1, 1, 1, 1);
  if (config.colorMode === 'gradient' && config.colorGradients && config.colorGradients.length > 0) {
    const sortedColorGradients = [...config.colorGradients].sort((a, b) => a.offset - b.offset);
    sortedColorGradients.forEach((grad) => {
      particleSystem.addColorGradient(clamp01(grad.offset), grad.color);
    });
  } else {
    particleSystem.color1 = baseColor.clone();
    particleSystem.color2 = baseColor.clone();
    particleSystem.colorDead = baseColor.clone();
  }

  if (config.sizeGradients && config.sizeGradients.length > 0) {
    const sortedSizeGradients = [...config.sizeGradients].sort((a, b) => a.offset - b.offset);
    const minFactor = minSize / baseSize;
    const maxFactor = maxSize / baseSize;
    sortedSizeGradients.forEach((grad) => {
      const size = Math.max(0.0001, grad.size);
      particleSystem.addSizeGradient(clamp01(grad.offset), size * minFactor, size * maxFactor);
    });
  }

  if (config.spriteSheet) {
    const startCellId = Math.max(0, Math.round(config.spriteSheet.startCellID));
    const endCellId = Math.max(startCellId, Math.round(config.spriteSheet.endCellID));
    particleSystem.isAnimationSheetEnabled = true;
    particleSystem.spriteCellWidth = Math.max(1, Math.round(config.spriteSheet.cellWidth));
    particleSystem.spriteCellHeight = Math.max(1, Math.round(config.spriteSheet.cellHeight));
    particleSystem.startSpriteCellID = startCellId;
    particleSystem.endSpriteCellID = endCellId;
    particleSystem.spriteRandomStartCell = Boolean(config.spriteSheet.randomStartCell);
    particleSystem.spriteCellChangeSpeed = Math.max(0, config.spriteSheet.spriteCellChangeSpeed);
    particleSystem.spriteCellLoop = Boolean(config.spriteSheet.loop);
  }

  if (isOneShot) {
    particleSystem.manualEmitCount = capacity;
    particleSystem.targetStopDuration = emitDuration;
  } else {
    particleSystem.emitRate = Math.max(1, config.emitRate ?? 50);
  }

  const direction1 = config.direction1 ?? new Vector3(-2, 2, -2);
  const direction2 = config.direction2 ?? new Vector3(2, 5, 2);
  const minEmitBox = config.minEmitBox ?? new Vector3(-0.2, 0, -0.2);
  const maxEmitBox = config.maxEmitBox ?? new Vector3(0.2, 0, 0.2);
  switch (config.emitterType ?? 'box') {
    case 'point': particleSystem.createPointEmitter(direction1, direction2); break;
    case 'sphere': particleSystem.createSphereEmitter(config.emitterRadius ?? 1, config.emitterRadiusRange ?? 1); break;
    case 'hemisphere': particleSystem.createHemisphericEmitter(config.emitterRadius ?? 1, config.emitterRadiusRange ?? 1); break;
    case 'cylinder': particleSystem.createCylinderEmitter(config.emitterRadius ?? 1, config.emitterHeight ?? 1, config.emitterRadiusRange ?? 1, config.emitterDirectionRandomizer ?? 0); break;
    case 'cone': particleSystem.createConeEmitter(config.emitterRadius ?? 1, config.emitterAngle ?? Math.PI / 4); break;
    default: particleSystem.createBoxEmitter(direction1, direction2, minEmitBox, maxEmitBox);
  }
  particleSystem.minEmitPower = Math.max(0.01, config.minEmitPower ?? 2);
  particleSystem.maxEmitPower = Math.max(particleSystem.minEmitPower, config.maxEmitPower ?? 5);
  particleSystem.updateSpeed = configuredUpdateSpeed;
  particleSystem.gravity = config.gravity ?? new Vector3(0, -9.81, 0);
  particleSystem.minInitialRotation = config.minInitialRotation ?? 0;
  particleSystem.maxInitialRotation = Math.max(particleSystem.minInitialRotation, config.maxInitialRotation ?? 0);
  particleSystem.minAngularSpeed = config.minAngularSpeed ?? 0;
  particleSystem.maxAngularSpeed = Math.max(particleSystem.minAngularSpeed, config.maxAngularSpeed ?? 0);
  particleSystem.minScaleX = Math.max(0.0001, config.minScaleX ?? 1);
  particleSystem.maxScaleX = Math.max(particleSystem.minScaleX, config.maxScaleX ?? 1);
  particleSystem.minScaleY = Math.max(0.0001, config.minScaleY ?? 1);
  particleSystem.maxScaleY = Math.max(particleSystem.minScaleY, config.maxScaleY ?? 1);
  particleSystem.startDelay = Math.max(0, Math.round(config.startDelayMs ?? 0));
  particleSystem.preWarmCycles = Math.max(0, Math.round(config.preWarmCycles ?? 0));
  particleSystem.preWarmStepOffset = Math.max(0, config.preWarmStepOffset ?? 1);
  particleSystem.applyFog = Boolean(config.applyFog);
  particleSystem.renderingGroupId = Math.max(0, Math.min(3, Math.round(config.renderingGroupId ?? 0)));
  particleSystem.billboardMode = config.billboardMode === 'y'
    ? ParticleSystem.BILLBOARDMODE_Y
    : config.billboardMode === 'stretched'
      ? ParticleSystem.BILLBOARDMODE_STRETCHED
      : ParticleSystem.BILLBOARDMODE_ALL;
  particleSystem.blendMode = overwrite
    ? ParticleSystem.BLENDMODE_STANDARD
    : config.blendMode === 'add'
      ? ParticleSystem.BLENDMODE_ADD
      : config.blendMode === 'multiply'
        ? ParticleSystem.BLENDMODE_MULTIPLY
        : ParticleSystem.BLENDMODE_STANDARD;
  particleSystem.forceDepthWrite = overwrite || Boolean(config.forceDepthWrite);

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
    pause: () => {
      particleSystem.updateSpeed = 0;
    },
    resume: () => {
      particleSystem.updateSpeed = configuredUpdateSpeed;
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
