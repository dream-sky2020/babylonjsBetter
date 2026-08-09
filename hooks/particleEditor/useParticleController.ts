import { useCallback } from 'react';
import { Color4, Vector3 } from '@babylonjs/core';
import type { MutableRefObject } from 'react';
import type { Scene } from '@babylonjs/core';
import {
  createBurstParticleEffect,
  normalizePublicPath,
  type ParticleController,
  type ParticleEditorPreset
} from '@/core/particle';

interface UseParticleControllerParams {
  sceneRef: MutableRefObject<Scene | null>;
  particleControllerRef: MutableRefObject<ParticleController | null>;
  preset: ParticleEditorPreset;
  setMessage: (message: string) => void;
}

interface UseParticleControllerResult {
  playParticle: () => void;
  stopParticle: () => void;
}

export const useParticleController = ({
  sceneRef,
  particleControllerRef,
  preset,
  setMessage
}: UseParticleControllerParams): UseParticleControllerResult => {
  const playParticle = useCallback(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    particleControllerRef.current?.dispose();
    const texturePath = encodeURI(`/${normalizePublicPath(preset.texturePath)}`);
    try {
      const controller = createBurstParticleEffect(scene, {
        texturePath,
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
        gravity: new Vector3(0, preset.gravityY, 0),
        minEmitBox: new Vector3(preset.minEmitBox.x, preset.minEmitBox.y, preset.minEmitBox.z),
        maxEmitBox: new Vector3(preset.maxEmitBox.x, preset.maxEmitBox.y, preset.maxEmitBox.z),
        direction1: new Vector3(preset.direction1.x, preset.direction1.y, preset.direction1.z),
        direction2: new Vector3(preset.direction2.x, preset.direction2.y, preset.direction2.z),
        colorGradients: preset.colorGradients.map((item) => ({
          offset: item.offset,
          color: new Color4(item.color.r, item.color.g, item.color.b, item.color.a)
        })),
        sizeGradients: preset.sizeGradients.map((item) => ({
          offset: item.offset,
          size: item.size
        }))
      });
      particleControllerRef.current = controller;
      controller.start();
      setMessage(`粒子效果播放中：${preset.name}`);
    } catch (error) {
      setMessage(`播放失败: ${String(error)}`);
    }
  }, [particleControllerRef, preset, sceneRef, setMessage]);

  const stopParticle = useCallback(() => {
    if (!particleControllerRef.current) return;
    particleControllerRef.current.stop();
    setMessage('粒子系统已停止');
  }, [particleControllerRef, setMessage]);

  return {
    playParticle,
    stopParticle
  };
};
