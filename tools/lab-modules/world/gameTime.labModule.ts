import {
  formatPlayTime,
  GAME_TIME_RUNNING_DATA_KEY,
  GAME_TIME_RUNTIME_MODULE_ID,
  PLAY_TIME_SECONDS_DATA_KEY,
  REAL_TIME_DATA_KEY,
  RECENT_BATTLE_TIMES_DATA_KEY,
  registerGameTime,
} from '@/core/game-time';
import { createLabField, createLabJson, createLabStatus, type LabModule } from '@/tools/lab-kit';

export const gameTimeLabModule: LabModule = {
  id: 'game-time',
  setup(context) {
    const controller = registerGameTime(context.runtime, context.runtimeScopes.game);

    const panel = context.ui.addPanel('game-time', '时间');
    const playTime = document.createElement('input');
    playTime.readOnly = true;
    const realTime = document.createElement('input');
    realTime.readOnly = true;
    const toggle = document.createElement('button');
    toggle.type = 'button';
    const reset = document.createElement('button');
    reset.type = 'button';
    reset.textContent = '重置游戏时间';
    const actions = document.createElement('div');
    actions.className = 'lab-module-actions';
    actions.append(toggle, reset);

    const battleSequence = document.createElement('input');
    battleSequence.type = 'number';
    battleSequence.min = '0';
    battleSequence.step = '1';
    battleSequence.value = '1';
    const battleToggle = document.createElement('button');
    battleToggle.type = 'button';

    const json = createLabJson('');
    const status = createLabStatus('四份时间数据已注册到当前 Lab 的 game Scope。');
    panel.content.append(
      createLabField('累计游戏时间', playTime),
      createLabField('现实时间', realTime),
      actions,
      createLabField('战斗数据序号', battleSequence),
      battleToggle,
      createLabField('Runtime 时间数据', json),
      status,
    );

    const refresh = () => {
      const currentPlayTime = controller.readPlayTime();
      playTime.value = formatPlayTime(currentPlayTime);
      realTime.value = controller.readRealTime();
      toggle.textContent = controller.running ? '暂停计时' : '继续计时';
      battleSequence.disabled = controller.activeBattleDataSequence !== null;
      battleToggle.textContent = controller.activeBattleDataSequence === null
        ? '开始战斗时间记录'
        : `结束战斗 #${controller.activeBattleDataSequence}`;
      json.textContent = JSON.stringify({
        moduleId: GAME_TIME_RUNTIME_MODULE_ID,
        scope: context.runtimeScopes.game.address,
        data: {
          [PLAY_TIME_SECONDS_DATA_KEY]: Math.round(currentPlayTime * 1000) / 1000,
          [GAME_TIME_RUNNING_DATA_KEY]: controller.running,
          [REAL_TIME_DATA_KEY]: controller.readRealTime(),
          [RECENT_BATTLE_TIMES_DATA_KEY]: controller.readRecentBattleTimes(),
        },
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
    battleToggle.addEventListener('click', () => {
      try {
        if (controller.activeBattleDataSequence === null) {
          controller.startBattle(Number(battleSequence.value));
          status.textContent = `开始记录战斗数据 #${battleSequence.value}。`;
        } else {
          const record = controller.finishBattle();
          battleSequence.value = String(record.battleDataSequence + 1);
          status.textContent = `战斗 #${record.battleDataSequence} 已记录，持续 ${record.durationSeconds.toFixed(3)} 秒。`;
        }
      } catch (error) {
        status.textContent = error instanceof Error ? error.message : String(error);
      }
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
