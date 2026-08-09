import { useCallback, useEffect, useRef, useState, type MutableRefObject } from 'react';
import { Vector3, type Scene } from '@babylonjs/core';
import { createParticleEffect, type ParticleController, type ParticleEffectDefinition, type ParticleOrbitRegistration } from '@/core/particle';

type PlaybackState = 'stopped' | 'playing' | 'paused';

interface UseParticleControllerParams {
  sceneRef: MutableRefObject<Scene | null>;
  particleControllerRef: MutableRefObject<ParticleController | null>;
  preset: ParticleEffectDefinition;
  setMessage: (message: string) => void;
}

export const useParticleController = ({ sceneRef, particleControllerRef, preset, setMessage }: UseParticleControllerParams) => {
  const [playbackState, setPlaybackState] = useState<PlaybackState>('stopped');
  const playbackStateRef = useRef<PlaybackState>('stopped');
  const definitionRef = useRef(preset);
  const pausedDefinitionDirtyRef = useRef(false);

  const setState = useCallback((state: PlaybackState) => {
    playbackStateRef.current = state;
    setPlaybackState(state);
  }, []);

  const createAndStart = useCallback((definition: ParticleEffectDefinition, paused = false) => {
    const scene = sceneRef.current;
    if (!scene) return false;
    particleControllerRef.current?.dispose();
    const controller = createParticleEffect(scene, definition, Vector3.Zero());
    particleControllerRef.current = controller;
    controller.start();
    if (paused) controller.pause();
    return true;
  }, [particleControllerRef, sceneRef]);

  const playParticle = useCallback(() => {
    try {
      if (!createAndStart(definitionRef.current)) return;
      pausedDefinitionDirtyRef.current = false;
      setState('playing');
      setMessage(`粒子效果播放中：${definitionRef.current.name}`);
    } catch (error) { setMessage(`播放失败: ${String(error)}`); }
  }, [createAndStart, setMessage, setState]);

  const pauseParticle = useCallback(() => {
    if (playbackStateRef.current !== 'playing' || !particleControllerRef.current) return;
    particleControllerRef.current.pause();
    setState('paused');
    setMessage('粒子预览已暂停');
  }, [particleControllerRef, setMessage, setState]);

  const resumeParticle = useCallback(() => {
    if (playbackStateRef.current !== 'paused') return;
    try {
      if (pausedDefinitionDirtyRef.current) {
        if (!createAndStart(definitionRef.current)) return;
        pausedDefinitionDirtyRef.current = false;
      } else particleControllerRef.current?.resume();
      setState('playing');
      setMessage(`粒子预览已继续：${definitionRef.current.name}`);
    } catch (error) { setMessage(`继续播放失败: ${String(error)}`); }
  }, [createAndStart, particleControllerRef, setMessage, setState]);

  const stopParticle = useCallback(() => {
    particleControllerRef.current?.stop();
    pausedDefinitionDirtyRef.current = false;
    setState('stopped');
    setMessage('粒子系统已停止');
  }, [particleControllerRef, setMessage, setState]);

  const spawnParticles = useCallback((count: number, initialOrbitId?: string) => {
    const accepted = particleControllerRef.current?.spawn(count, { initialOrbitId }) ?? 0;
    setMessage(`已发送生成命令：${accepted} 个粒子`);
    return accepted;
  }, [particleControllerRef, setMessage]);

  const retireParticles = useCallback((count: number) => {
    const accepted = particleControllerRef.current?.retire(count) ?? 0;
    setMessage(`已发送退出命令：${accepted} 个粒子`);
    return accepted;
  }, [particleControllerRef, setMessage]);

  const retireAllParticles = useCallback(() => {
    const accepted = particleControllerRef.current?.retireAll() ?? 0;
    setMessage(`已发送全部退出命令：${accepted} 个粒子`);
    return accepted;
  }, [particleControllerRef, setMessage]);

  const setRuntimeCapacity = useCallback((capacity: number) => {
    const applied = particleControllerRef.current?.setCapacity(capacity) ?? 0;
    setMessage(`运行容量已设置为：${applied}`);
    return applied;
  }, [particleControllerRef, setMessage]);
  const getActiveCount = useCallback(() => particleControllerRef.current?.getActiveCount() ?? 0, [particleControllerRef]);
  const registerOrbit = useCallback((registration: ParticleOrbitRegistration) => particleControllerRef.current?.registerOrbit(registration) ?? false, [particleControllerRef]);
  const unregisterOrbit = useCallback((orbitId: string, fallbackOrbitId?: string) => particleControllerRef.current?.unregisterOrbit(orbitId, fallbackOrbitId) ?? false, [particleControllerRef]);
  const transferCount = useCallback((count: number, fromOrbitId: string | undefined, orbitId: string, duration: number) => particleControllerRef.current?.transferCount(count, fromOrbitId, orbitId, { duration }) ?? 0, [particleControllerRef]);
  const transferByIds = useCallback((ids: readonly number[], orbitId: string, duration: number) => particleControllerRef.current?.transferByIds(ids, orbitId, { duration }) ?? 0, [particleControllerRef]);
  const transitionAll = useCallback((orbitId: string, duration: number) => particleControllerRef.current?.transitionAll(orbitId, { duration }) ?? 0, [particleControllerRef]);
  const getParticleIds = useCallback((orbitId?: string) => particleControllerRef.current?.getParticleIds(orbitId) ?? [], [particleControllerRef]);

  useEffect(() => {
    definitionRef.current = preset;
    if (playbackStateRef.current === 'paused') {
      pausedDefinitionDirtyRef.current = true;
      return;
    }
    if (playbackStateRef.current !== 'playing') return;
    try {
      createAndStart(preset);
      setMessage(`参数已实时应用：${preset.name}`);
    } catch (error) { setMessage(`实时预览更新失败: ${String(error)}`); }
  }, [createAndStart, preset, setMessage]);

  return { playParticle, pauseParticle, resumeParticle, stopParticle, spawnParticles, retireParticles, retireAllParticles, setRuntimeCapacity, getActiveCount, registerOrbit, unregisterOrbit, transferCount, transferByIds, transitionAll, getParticleIds, playbackState };
};
