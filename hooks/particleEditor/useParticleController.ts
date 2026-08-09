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
        colorGradients: visualPreset.colorGradients.map((item) => ({
          offset: item.offset,
          color: new Color4(item.color.r, item.color.g, item.color.b, item.color.a)
        })),
        sizeGradients: visualPreset.sizeGradients.map((item) => ({
          offset: item.offset,
          size: item.size
        }))
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
