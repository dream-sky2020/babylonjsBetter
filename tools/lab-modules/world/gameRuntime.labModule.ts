import { createGameRuntime, type GameRuntime } from '@/core/game-runtime';
import type { LabModule } from '@/tools/lab-kit';
import {
  WORLD_LAB_SERVICES,
  gameRuntimeActivateWorldRequest,
  gameRuntimeReadyEvent,
} from './worldLab.types';

/**
 * WorldRuntime 的临时兼容装配器。
 * 游戏时间已经迁移到 game-time 模块，不得在这里再次累计或保存。
 */
export const gameRuntimeLabModule: LabModule = {
  id: 'game-runtime',
  dependencies: ['world-loader', 'game-time'],
  setup(context) {
    let runtime: GameRuntime | null = null;
    context.communication.handle(gameRuntimeActivateWorldRequest, async ({ worldPresetKey }) => {
      runtime = createGameRuntime(worldPresetKey);
      context.services.set(WORLD_LAB_SERVICES.runtime, runtime.activeWorld);
      await context.communication.publish(gameRuntimeReadyEvent, { worldPresetKey });
      return { activated: true, worldPresetKey };
    });
    return () => {
      runtime = null;
    };
  },
};
