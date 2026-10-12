import { createServiceToken } from '../system-runtime/ServiceToken.ts';
import type { DungeonPlayerSystem } from './dungeonPlayerSystem';
import type { DungeonRuntime, DungeonRuntimePlayerPosition } from '../dungeon-runtime/dungeonRuntime.types.ts';
import { setDungeonRuntimePlayerMovementProfile, setDungeonRuntimePlayerPosition } from '../dungeon-runtime/dungeonRuntime.ts';
import { inspectDungeonPlayerMovement } from './dungeonPlayerMovement.ts';

type Commands = Pick<DungeonPlayerSystem, 'move' | 'moveRelative' | 'turn' | 'update'>;
export type DungeonPlayerCommands = Commands & {
  inspect(...args: Parameters<typeof inspectDungeonPlayerMovement> extends [unknown, ...infer Rest] ? Rest : never): ReturnType<typeof inspectDungeonPlayerMovement>;
  setMovementProfile(profileId: string): void;
  teleport(position: DungeonRuntimePlayerPosition, worldPosition: readonly [number, number, number]): void;
};
export type DungeonPlayerControl = { acquire(loadId: number): DungeonPlayerCommands | null };
export const DUNGEON_PLAYER_CONTROL_SERVICE_KEY = createServiceToken<DungeonPlayerControl>('dungeon:player-control');

/** Session command facade; exposes no Runtime or mutable secondary state. */
export const createDungeonPlayerControl = (read: () => { loadId: number; system: Commands; runtime: DungeonRuntime } | null): DungeonPlayerControl => ({
  acquire(loadId) {
    const session = read();
    if (!session || session.loadId !== loadId) return null;
    const requireCurrent = () => {
      const active = read();
      if (!active || active.loadId !== loadId || active.system !== session.system || active.runtime !== session.runtime)
        throw new Error('玩家命令所属地图已切换。');
      return session;
    };
    return {
      move: (...args) => requireCurrent().system.move(...args),
      moveRelative: (...args) => requireCurrent().system.moveRelative(...args),
      turn: (...args) => requireCurrent().system.turn(...args),
      update: (...args) => requireCurrent().system.update(...args),
      inspect: (...args) => inspectDungeonPlayerMovement(requireCurrent().runtime, ...args),
      setMovementProfile: profileId => setDungeonRuntimePlayerMovementProfile(requireCurrent().runtime, profileId),
      teleport(position, worldPosition) {
        const runtime = requireCurrent().runtime;
        setDungeonRuntimePlayerPosition(runtime, position);
        runtime.playerWorldPosition = [...worldPosition];
      },
    };
  },
});
