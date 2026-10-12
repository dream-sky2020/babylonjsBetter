import { createServiceToken } from '../system-runtime/ServiceToken.ts';
import type { DungeonAgentSystem } from './dungeonAgentSystem';
import type { DungeonRuntimeMap } from '../dungeon-runtime/dungeonRuntimeMap.ts';
import { startDungeonAgentMovement, startDungeonAgentTurn, syncDungeonAgentPathReservation } from './dungeonAgent.runtime.ts';
import { setDungeonAgentControllerOverride, clearDungeonAgentControllerOverride, type DungeonAgentController } from './dungeonAgent.controllers.ts';

/** Agent's existing domain state is retained while its map dependency is migrated. */
export type DungeonAgentCommands = Pick<DungeonAgentSystem, 'state' | 'settings' | 'update' | 'afterPlayerStep'> & {
  move(...args: Parameters<typeof startDungeonAgentMovement> extends [unknown, unknown, ...infer Rest] ? Rest : never): ReturnType<typeof startDungeonAgentMovement>;
  setController(entityId: string, controller: DungeonAgentController, parameters?: Readonly<Record<string, unknown>>): void;
  resetController(entityId: string): void;
  turn(entityId: string, turn: Parameters<typeof startDungeonAgentTurn>[2], durationSeconds: number): ReturnType<typeof startDungeonAgentTurn>;
  setMovementProfile(entityId: string, profileId: string): void;
};
type Session = { loadId: number; system: Pick<DungeonAgentSystem, 'state' | 'settings' | 'update' | 'afterPlayerStep'>; map: DungeonRuntimeMap };
export type DungeonAgentControl = { acquire(loadId: number): DungeonAgentCommands | null };
export const DUNGEON_AGENT_CONTROL_SERVICE_KEY = createServiceToken<DungeonAgentControl>('dungeon:agent-control');
export const createDungeonAgentControl = (read: () => Session | null): DungeonAgentControl => ({
  acquire(loadId) {
    const session = read(); if (!session || session.loadId !== loadId) return null;
    const requireCurrent = () => {
      const current = read();
      if (!current || current.loadId !== loadId || current.system !== session.system || current.map !== session.map)
        throw new Error('Agent 命令所属地图已切换。');
      return session;
    };
    return {
      state: session.system.state, settings: session.system.settings,
      update: delta => requireCurrent().system.update(delta),
      afterPlayerStep: event => requireCurrent().system.afterPlayerStep(event),
      move: (...args) => { const current = requireCurrent(); return startDungeonAgentMovement(current.system.state, current.map, ...args); },
      turn: (entityId, turn, duration) => startDungeonAgentTurn(requireCurrent().system.state, entityId, turn, duration),
      setMovementProfile: (entityId, profileId) => {
        const state = requireCurrent().system.state;
        const index = state.agentIndexByEntityId.get(entityId);
        if (index === undefined || !state.traversal.actors.has(entityId)) return;
        state.traversal.setActorMovementProfile(entityId, profileId);
        const agent = state.agents[index]!;
        agent.navigationPlan = undefined;
        syncDungeonAgentPathReservation(state, agent);
      },
      setController: (entityId, controller, parameters) => {
        const state = requireCurrent().system.state;
        const index = state.agentIndexByEntityId.get(entityId);
        if (index !== undefined) setDungeonAgentControllerOverride(state.agents[index]!, controller, parameters, state);
      },
      resetController: entityId => {
        const state = requireCurrent().system.state;
        const index = state.agentIndexByEntityId.get(entityId);
        if (index !== undefined) clearDungeonAgentControllerOverride(state.agents[index]!, state);
      },
    };
  },
});
