import {
  formatPlayTime,
  GAME_TIME_RUNTIME_MODULE_ID,
  PLAY_TIME_SECONDS_DATA_KEY,
  registerGameTime,
} from '@/core/game-time';
import { createLabField, createLabJson, createLabStatus, type LabModule } from '@/tools/lab-kit';
import { WORLD_LAB_SERVICES } from './worldLab.types';

export const gameTimeLabModule: LabModule = {
  id: 'game-time',
  setup(context) {
    const controller = registerGameTime(context.runtime, context.runtimeScopes.game);
    context.services.set(WORLD_LAB_SERVICES.gameTime, controller);

    const panel = context.ui.addPanel('game-time', '时间');
    const playTime = document.createElement('input');
    playTime.readOnly = true;
    const toggle = document.createElement('button');
    toggle.type = 'button';
    const reset = document.createElement('button');
    reset.type = 'button';
    reset.textContent = '重置游戏时间';
    const actions = document.createElement('div');
    actions.className = 'lab-module-actions';
    actions.append(toggle, reset);
    const json = createLabJson('');
    const status = createLabStatus('playTimeSeconds 已注册到当前 Lab 的 game Scope。');
    panel.content.append(createLabField('累计游戏时间', playTime), actions, json, status);

    const refresh = () => {
      const current = controller.readPlayTime();
      playTime.value = formatPlayTime(current);
      toggle.textContent = controller.running ? '暂停计时' : '继续计时';
      json.textContent = JSON.stringify({
        moduleId: GAME_TIME_RUNTIME_MODULE_ID,
        dataKey: PLAY_TIME_SECONDS_DATA_KEY,
        scope: context.runtimeScopes.game.address,
        data: Math.round(current * 1000) / 1000,
      }, null, 2);
    };

    toggle.addEventListener('click', () => {
      if (controller.running) controller.pause();
      else controller.start();
      refresh();
    });
    reset.addEventListener('click', () => {
      controller.reset();
      refresh();
    });

    let elapsedSinceRefresh = 0;
    const frame = context.engine.onBeginFrameObservable.add(() => {
      const deltaSeconds = context.engine.getDeltaTime() / 1000;
      controller.update(deltaSeconds);
      elapsedSinceRefresh += deltaSeconds;
      if (elapsedSinceRefresh >= 0.1) {
        elapsedSinceRefresh = 0;
        refresh();
      }
    });

    controller.start();
    refresh();
    return () => {
      controller.pause();
      context.engine.onBeginFrameObservable.remove(frame);
    };
  },
};