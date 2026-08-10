import { useCallback, useState } from 'react';
import { Color4, Vector3 } from '@babylonjs/core';
import type { MutableRefObject } from 'react';
import type { Scene } from '@babylonjs/core';
import {
  createBurstParticleEffect,
  normalizePublicPath,
  type ParticleController,
  type ParticleEditorPreset,
  type ParticleVisualPreset
} from '@/core/particle';

interface UseParticleControllerParams {
  sceneRef: MutableRefObject<Scene | null>;
  particleControllerRef: MutableRefObject<ParticleController | null>;
  preset: ParticleEditorPreset;
  visualPreset: ParticleVisualPreset;
  setMessage: (message: string) => void;
}

interface UseParticleControllerResult {
  playParticle: () => void;
  pauseParticle: () => void;
  resumeParticle: () => void;
  stopParticle: () => void;
  playbackState: 'stopped' | 'playing' | 'paused';
}

export const useParticleController = ({
  sceneRef,
  particleControllerRef,
  preset,
  visualPreset,
  setMessage
}: UseParticleControllerParams): UseParticleControllerResult => {
  const [playbackState, setPlaybackState] = useState<'stopped' | 'playing' | 'paused'>('stopped');
  const playParticle = useCallback(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    particleControllerRef.current?.dispose();
    const texturePath = encodeURI(`/${normalizePublicPath(visualPreset.texturePath).replace(/^public\//, '')}`);
    try {
      const controller = createBurstParticleEffect(scene, {
        texturePath,
        colorMode: visualPreset.colorMode,
        blendMode: visualPreset.blendMode,
        baseSize: visualPreset.baseSize,
        minSize: visualPreset.minSize,
        maxSize: visualPreset.maxSize,
        baseColor: new Color4(
          visualPreset.baseColor.r,
          visualPreset.baseColor.g,
          visualPreset.baseColor.b,
          visualPreset.baseColor.a
        ),
        spriteSheet: visualPreset.spriteSheet ? (() => {
          const sheet = visualPreset.spriteSheet;
          const cellCount = Math.max(1, sheet.endCellID - sheet.startCellID + 1);
          const averageLifeTime = (preset.minLifeTime + preset.maxLifeTime) / 2;
          return {
            ...sheet,
            spriteCellChangeSpeed: sheet.playbackMode === 'loop'
              ? sheet.framesPerSecond * averageLifeTime / cellCount
              : 0,
            loop: sheet.playbackMode === 'loop'
          };
        })() : undefined,
        capacity: preset.capacity,
        emitter: Vector3.Zero(),
        isOneShot: preset.isOneShot,
        autoDispose: preset.autoDispose,
        minLifeTime: preset.minLifeTime,
        maxLifeTime: preset.maxLifeTime,
        emitDuration: preset.emitDuration,
        emitRate: preset.emitRate,
        minEmitPower: preset.minEmitPower,
        maxEmitPower: preset.maxEmitPower,
        updateSpeed: preset.updateSpeed,
        gravity: new Vector3(preset.gravity.x, preset.gravity.y, preset.gravity.z),
        minInitialRotation: preset.minInitialRotationDeg * Math.PI / 180,
        maxInitialRotation: preset.maxInitialRotationDeg * Math.PI / 180,
        minAngularSpeed: preset.minAngularSpeedDeg * Math.PI / 180,
        maxAngularSpeed: preset.maxAngularSpeedDeg * Math.PI / 180,
        minScaleX: preset.minScaleX,
        maxScaleX: preset.maxScaleX,
        minScaleY: preset.minScaleY,
        maxScaleY: preset.maxScaleY,
        startDelayMs: preset.startDelayMs,
        preWarmCycles: preset.preWarmCycles,
        preWarmStepOffset: preset.preWarmStepOffset,
        forceDepthWrite: preset.forceDepthWrite,
        applyFog: preset.applyFog,
        renderingGroupId: preset.renderingGroupId,
        billboardMode: preset.billboardMode,
        emitterType: preset.emitterType,
        emitterRadius: preset.emitterRadius,
        emitterRadiusRange: preset.emitterRadiusRange,
        emitterHeight: preset.emitterHeight,
        emitterDirectionRandomizer: preset.emitterDirectionRandomizer,
        emitterAngle: preset.emitterAngleDeg * Math.PI / 180,
        minEmitBox: new Vector3(preset.minEmitBox.x, preset.minEmitBox.y, preset.minEmitBox.z),
        maxEmitBox: new Vector3(preset.maxEmitBox.x, preset.maxEmitBox.y, preset.maxEmitBox.z),
        direction1: new Vector3(preset.direction1.x, preset.direction1.y, preset.direction1.z),
        direction2: new Vector3(preset.direction2.x, preset.direction2.y, preset.direction2.z),
        colorGradients: visualPreset.colorGradientsEnabled ? visualPreset.colorGradients.map((item) => ({
          offset: item.offset,
          color: new Color4(item.color.r, item.color.g, item.color.b, item.color.a)
        })) : undefined,
        sizeGradients: visualPreset.sizeGradientsEnabled ? visualPreset.sizeGradients.map((item) => ({
          offset: item.offset,
          size: item.size
        })) : undefined
      });
      particleControllerRef.current = controller;
      controller.start();
      setPlaybackState('playing');
      setMessage(`粒子效果播放中：${preset.name}`);
    } catch (error) {
      setMessage(`播放失败: ${String(error)}`);
    }
  }, [particleControllerRef, preset, sceneRef, setMessage, visualPreset]);

  const pauseParticle = useCallback(() => {
    if (!particleControllerRef.current) return;
    particleControllerRef.current.pause();
    setPlaybackState('paused');
    setMessage('粒子预览已暂停');
  }, [particleControllerRef, setMessage]);

  const resumeParticle = useCallback(() => {
    if (!particleControllerRef.current) return;
    particleControllerRef.current.resume();
    setPlaybackState('playing');
    setMessage('粒子预览继续播放');
  }, [particleControllerRef, setMessage]);

  const stopParticle = useCallback(() => {
    if (!particleControllerRef.current) return;
    particleControllerRef.current.stop();
    setPlaybackState('stopped');
    setMessage('粒子系统已停止');
  }, [particleControllerRef, setMessage]);

  return {
    playParticle,
    pauseParticle,
    resumeParticle,
    stopParticle,
    playbackState
  };
};
