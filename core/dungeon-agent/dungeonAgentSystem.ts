import type { DungeonRuntime } from '../dungeon-runtime';
import { createDungeonAgentRuntimeState, updateDungeonAgentMovements, getDungeonActiveAgents } from './dungeonAgent.runtime.ts';
import { updateDungeonAgentControllers, runDungeonAgentControllersAfterPlayerStep,
  type DungeonAgentControllerRegistry } from './dungeonAgent.controllers.ts';
import type { DungeonPlayerStepCompleted } from '../dungeon-player-movement/dungeonPlayerStepEvents';

export type DungeonAgentSettings = {
  controllersEnabled: boolean; decisionIntervalSeconds: number; maxPathSearchesPerDecision: number;
};
export type DungeonAgentMetrics = { decisions: number; decisionMs: number; maxDecisionMs: number; searches: number; searchMs: number; visited: number };
export type DungeonAgentSystemStorage = NonNullable<Parameters<typeof createDungeonAgentRuntimeState>[3]> & {
  settings: DungeonAgentSettings;
  clock: { decisionElapsed: number };
  metrics?: Map<string, DungeonAgentMetrics>;
};

/** Headless Agent system. Controls edit settings; simulation never reads UI elements. */
export class DungeonAgentSystem {
  readonly state: ReturnType<typeof createDungeonAgentRuntimeState>;
  readonly runtime: DungeonRuntime;
  readonly registry: DungeonAgentControllerRegistry;
  readonly settings: DungeonAgentSettings;
  private readonly clock: { decisionElapsed: number };
  private readonly metrics?: Map<string, DungeonAgentMetrics>;
  private metric(entityId: string): DungeonAgentMetrics {
    let row = this.metrics!.get(entityId);
    if (!row) { row = { decisions: 0, decisionMs: 0, maxDecisionMs: 0, searches: 0, searchMs: 0, visited: 0 }; this.metrics!.set(entityId, row); }
    return row;
  }
  private get measurement() {
    if (!this.metrics) return {};
    return {
      onDecision: (id: string, ms: number) => { const row = this.metric(id); row.decisions++; row.decisionMs += ms; row.maxDecisionMs = Math.max(row.maxDecisionMs, ms); },
      onPathSearch: (id: string, ms: number, visited: number) => { const row = this.metric(id); row.searches++; row.searchMs += ms; row.visited += visited; },
    };
  }
  private get decisionElapsed() { return this.clock.decisionElapsed; }
  private set decisionElapsed(value: number) { this.clock.decisionElapsed = value; }

  constructor(runtime: DungeonRuntime, registry: DungeonAgentControllerRegistry, storage?: DungeonAgentSystemStorage) {
    this.runtime = runtime;
    this.registry = registry;
    this.settings = storage?.settings ?? { controllersEnabled: true, decisionIntervalSeconds: 0.1, maxPathSearchesPerDecision: 2 };
    this.clock = storage?.clock ?? { decisionElapsed: 0 };
    this.metrics = storage?.metrics;
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
        ...this.measurement,
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
      ...this.measurement,
    });
  }
}
