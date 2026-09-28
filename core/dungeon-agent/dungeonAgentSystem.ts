import type { DungeonRuntime } from '../dungeon-runtime';
import { createDungeonAgentRuntimeState, updateDungeonAgentMovements } from './dungeonAgent.runtime';
import { updateDungeonAgentControllers, runDungeonAgentControllersAfterPlayerStep,
  type DungeonAgentControllerRegistry } from './dungeonAgent.controllers';
import type { DungeonPlayerStepCompleted } from '../dungeon-player-movement/dungeonPlayerStepEvents';

/** Headless Agent system. Controls edit settings; simulation never reads UI elements. */
export class DungeonAgentSystem {
  readonly state: ReturnType<typeof createDungeonAgentRuntimeState>;
  readonly runtime: DungeonRuntime;
  readonly registry: DungeonAgentControllerRegistry;
  readonly settings = { controllersEnabled: true, decisionIntervalSeconds: 0.1, maxPathSearchesPerDecision: 2 };
  private decisionElapsed = 0;

  constructor(runtime: DungeonRuntime, registry: DungeonAgentControllerRegistry) {
    this.runtime = runtime;
    this.registry = registry;
    this.state = createDungeonAgentRuntimeState(runtime.map, runtime.traversal, runtime.movementResolver);
  }

  update(deltaSeconds: number) {
    const changed = new Set(this.state.activeAgents ?? []);
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
    this.state.activeAgents?.forEach(agent => changed.add(agent));
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