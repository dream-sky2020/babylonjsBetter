import type { DungeonRuntime } from '../dungeon-runtime';
import { createDungeonAgentRuntimeState, updateDungeonAgentMovements, getDungeonActiveAgents } from './dungeonAgent.runtime.ts';
import { updateDungeonAgentControllers, runDungeonAgentControllersAfterPlayerStep,
  type DungeonAgentControllerRegistry } from './dungeonAgent.controllers.ts';
import type { DungeonPlayerStepCompleted } from '../dungeon-player-movement/dungeonPlayerStepEvents';

export type DungeonAgentSettings = {
  controllersEnabled: boolean; decisionIntervalSeconds: number; maxPathSearchesPerDecision: number;
};
export type DungeonAgentSystemStorage = NonNullable<Parameters<typeof createDungeonAgentRuntimeState>[3]> & {
  settings: DungeonAgentSettings;
  clock: { decisionElapsed: number };
};

/** Headless Agent system. Controls edit settings; simulation never reads UI elements. */
export class DungeonAgentSystem {
  readonly state: ReturnType<typeof createDungeonAgentRuntimeState>;
  readonly runtime: DungeonRuntime;
  readonly registry: DungeonAgentControllerRegistry;
  readonly settings: DungeonAgentSettings;
  private readonly clock: { decisionElapsed: number };
  private get decisionElapsed() { return this.clock.decisionElapsed; }
  private set decisionElapsed(value: number) { this.clock.decisionElapsed = value; }

  constructor(runtime: DungeonRuntime, registry: DungeonAgentControllerRegistry, storage?: DungeonAgentSystemStorage) {
    this.runtime = runtime;
    this.registry = registry;
    this.settings = storage?.settings ?? { controllersEnabled: true, decisionIntervalSeconds: 0.1, maxPathSearchesPerDecision: 2 };
    this.clock = storage?.clock ?? { decisionElapsed: 0 };
    this.state = createDungeonAgentRuntimeState(runtime.map, runtime.traversal, runtime.movementResolver, storage);
  }

  update(deltaSeconds: number) {
    const changed = new Set(getDungeonActiveAgents(this.state));
    const completed = updateDungeonAgentMovements(this.state, deltaSeconds);
    this.decisionElapsed += deltaSeconds;
    let actions: ReturnType<typeof updateDungeonAgentControllers> = [];
    if (!this.settings.controllersEnabled) this.decisionElapsed = 0;
    else if (this.decisionElapsed >= this.settings.decisionIntervalSeconds) {
      const elapsed = this.decisionElapsed;
      this.decisionElapsed = 0;
      actions = updateDungeonAgentControllers(this.state, this.runtime.map, this.registry, elapsed, {
        playerTileIndex: this.runtime.playerPosition.tileY * this.runtime.map.width + this.runtime.playerPosition.tileX,
        reservationPenalty: 2, maxPathSearchesPerUpdate: this.settings.maxPathSearchesPerDecision,
      });
    }
    getDungeonActiveAgents(this.state).forEach(agent => changed.add(agent));
    for (const action of actions) {
      const index = this.state.agentIndexByEntityId.get(action.entityId);
      if (index !== undefined) changed.add(this.state.agents[index]!);
    }
    return { completed, actions, changed };
  }

  afterPlayerStep(event: DungeonPlayerStepCompleted) {
    if (!this.settings.controllersEnabled) return [];
    return runDungeonAgentControllersAfterPlayerStep(this.state, this.runtime.map, this.registry, {
      playerTileIndex: event.to.tileY * this.runtime.map.width + event.to.tileX,
      reservationPenalty: 2, maxPathSearchesPerUpdate: this.settings.maxPathSearchesPerDecision,
    });
  }
}
