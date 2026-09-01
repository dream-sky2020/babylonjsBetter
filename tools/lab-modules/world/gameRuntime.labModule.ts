import { createGameRuntime, type GameRuntime } from '@/core/game-runtime';
import type { LabModule } from '@/tools/lab-kit';
import { WORLD_LAB_SERVICES, type GameRuntimeReadyEvent, type WorldRequestedEvent } from './worldLab.types';

/**
 * 旧 WorldRuntime / DungeonSession 的临时兼容装配器。
 * 游戏时间已经迁移到 game-time 模块，不得在这里再次累计或保存。
 */
export const gameRuntimeLabModule: LabModule = {
  id: 'game-runtime',
  dependencies: ['world-loader', 'game-time'],
  setup(context) {
    let runtime: GameRuntime | null = null;
    const off = context.events.on<WorldRequestedEvent>('world:requested', async (event) => {
      runtime = createGameRuntime(event.preset.presetKey);
      context.services.set(WORLD_LAB_SERVICES.gameRuntime, runtime);
      context.services.set(WORLD_LAB_SERVICES.runtime, runtime.activeWorld);
      const ready: GameRuntimeReadyEvent = { ...event, gameRuntime: runtime, worldRuntime: runtime.activeWorld };
      await context.events.emit('game:runtime-ready', ready);
    });
    return () => {
      off();
      runtime = null;
    };
  },
};