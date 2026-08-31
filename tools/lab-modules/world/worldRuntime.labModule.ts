import {
  createWorldRuntime,
  createWorldRuntimeSnapshot,
  pauseWorldRuntimePlayTime,
  resetWorldRuntimePlayTime,
  startWorldRuntimePlayTime,
  updateWorldRuntime,
  type WorldRuntime,
} from '@/core/world-runtime';
import { createLabField, createLabJson, createLabStatus, type LabModule } from '@/tools/lab-kit';
import { WORLD_LAB_SERVICES, type WorldRequestedEvent, type WorldRuntimeReadyEvent } from './worldLab.types';

const formatPlayTime = (seconds: number): string => {
  const wholeSeconds = Math.floor(seconds);
  const hours = Math.floor(wholeSeconds / 3600);
  const minutes = Math.floor((wholeSeconds % 3600) / 60);
  const remainder = wholeSeconds % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`;
};

export const worldRuntimeLabModule: LabModule = {
  id: 'world-runtime',
  dependencies: ['world-loader'],
  setup(context) {
    const panel = context.ui.addPanel('world-runtime', '世界动态数据');
    const worldKey = document.createElement('input');
    worldKey.readOnly = true;
    const playTime = document.createElement('input');
    playTime.readOnly = true;
    const toggleButton = document.createElement('button');
    toggleButton.type = 'button';
    toggleButton.textContent = '暂停计时';
    const resetButton = document.createElement('button');
    resetButton.type = 'button';
    resetButton.textContent = '重置游玩时间';
    const actions = document.createElement('div');
    actions.className = 'lab-module-actions';
    actions.append(toggleButton, resetButton);
    const snapshotJson = createLabJson('尚未创建 WorldRuntime。');
    const status = createLabStatus('等待世界加载……');
    panel.content.append(createLabField('世界预设 Key', worldKey), createLabField('累计游玩时间', playTime), actions, snapshotJson, status);

    let runtime: WorldRuntime | null = null;
    let refreshElapsedSeconds = 0;
    const refresh = () => {
      worldKey.value = runtime?.worldPresetKey ?? '';
      playTime.value = runtime ? formatPlayTime(runtime.playTimeSeconds) : '00:00:00';
      toggleButton.disabled = !runtime;
      resetButton.disabled = !runtime;
      toggleButton.textContent = runtime?.playTimeRunning ? '暂停计时' : '继续计时';
      snapshotJson.textContent = runtime ? JSON.stringify(createWorldRuntimeSnapshot(runtime), null, 2) : '尚未创建 WorldRuntime。';
    };
    toggleButton.addEventListener('click', () => {
      if (!runtime) return;
      if (runtime.playTimeRunning) pauseWorldRuntimePlayTime(runtime);
      else startWorldRuntimePlayTime(runtime);
      status.textContent = runtime.playTimeRunning ? '游玩时间正在累计。' : '游玩时间已暂停。';
      refresh();
    });
    resetButton.addEventListener('click', () => {
      if (!runtime) return;
      resetWorldRuntimePlayTime(runtime);
      status.textContent = '游玩时间已重置。';
      refresh();
    });

    refresh();
    const frameObserver = context.scene.onBeforeRenderObservable.add(() => {
      if (!runtime) return;
      const deltaSeconds = context.engine.getDeltaTime() / 1000;
      updateWorldRuntime(runtime, deltaSeconds);
      refreshElapsedSeconds += deltaSeconds;
      if (refreshElapsedSeconds >= 0.1) { refreshElapsedSeconds = 0; refresh(); }
    });
    const offWorldRequested = context.events.on<WorldRequestedEvent>('world:requested', async (event) => {
      runtime = createWorldRuntime(event.preset.presetKey);
      startWorldRuntimePlayTime(runtime);
      context.services.set(WORLD_LAB_SERVICES.runtime, runtime);
      const readyEvent: WorldRuntimeReadyEvent = { ...event, runtime };
      await context.events.emit('world:runtime-ready', readyEvent);
      status.textContent = `世界“${event.preset.name}”的 WorldRuntime 已创建并开始计时。`;
      refresh();
    });
    return () => {
      offWorldRequested();
      context.scene.onBeforeRenderObservable.remove(frameObserver);
    };
  },
};
