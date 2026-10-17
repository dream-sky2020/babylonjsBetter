import { DUNGEON_PLAYER_TRAVERSAL_ACTOR_ID } from '../dungeon-traversal/index.ts';
import type { DungeonRuntime } from '../dungeon-runtime';
import type { DungeonMovementDirection } from '../dungeon-movement';
import { DungeonPlayerStepEvents, type DungeonPlayerStepCompleted } from './dungeonPlayerStepEvents.ts';
import { startDungeonPlayerMovement, startDungeonPlayerRelativeMovement, startDungeonPlayerTurn,
  updateDungeonPlayerMovement, type DungeonPlayerMovementOptions, type DungeonPlayerRelativeMovement,
  type DungeonPlayerTurn, type DungeonPlayerMovementResult } from './dungeonPlayerMovement.ts';

type StepOutcome = { step?: DungeonPlayerStepCompleted; stopContinuation: boolean };

/** Headless player commands and action advancement. Input adapters choose continuation commands. */
export class DungeonPlayerSystem {
  readonly runtime: DungeonRuntime;
  readonly loadId: number;
  private readonly steps: DungeonPlayerStepEvents;
  private readonly groupStepListeners = new Set<(outcome: StepOutcome) => void>();

  get isBusy(): boolean { return this.runtime.movementResolver.isBusy(DUNGEON_PLAYER_TRAVERSAL_ACTOR_ID); }

  subscribeGroupStep(listener: (outcome: StepOutcome) => void): () => void {
    this.groupStepListeners.add(listener);
    return () => { this.groupStepListeners.delete(listener); };
  }

  constructor(runtime: DungeonRuntime, loadId: number, steps: DungeonPlayerStepEvents) {
    this.runtime = runtime; this.loadId = loadId; this.steps = steps;
    runtime.movementResolver.subscribeGroupCompleted(group => {
      const member=group.members.find(row=>row.actorId===DUNGEON_PLAYER_TRAVERSAL_ACTOR_ID);
      if (member) {
        const outcome = this.completedStep({tileX:member.from%runtime.map.width,tileY:Math.floor(member.from/runtime.map.width)},group.id);
        for (const listener of this.groupStepListeners) listener(outcome);
      }
    });
    if (!runtime.traversal.actors.has(DUNGEON_PLAYER_TRAVERSAL_ACTOR_ID)) runtime.traversal.registerActor({
      id: DUNGEON_PLAYER_TRAVERSAL_ACTOR_ID, kind: 'player',
      tileIndex: runtime.playerPosition.tileY * runtime.map.width + runtime.playerPosition.tileX,
      enabled: true, blocksMovement: true, spatialFootprint: 'center', movementProfileId: 'ground',
    });
  }

  private completedStep(from: { tileX: number; tileY: number }, requestId?: string): StepOutcome {
    const result = this.steps.emit({ loadId: this.loadId, from, to: this.runtime.playerPosition,
      facing: this.runtime.playerFacing, requestId });
    return { step: result.event, stopContinuation: result.stopContinuation };
  }

  move(direction: DungeonMovementDirection, options: DungeonPlayerMovementOptions): DungeonPlayerMovementResult & StepOutcome {
    const result = startDungeonPlayerMovement(this.runtime, direction, options);
    return { ...result, ...(result.started && result.completed && !result.blockedReason
      ? this.completedStep(result.from) : { stopContinuation: false }) };
  }

  moveRelative(direction: DungeonPlayerRelativeMovement, options: DungeonPlayerMovementOptions): DungeonPlayerMovementResult & StepOutcome {
    const result = startDungeonPlayerRelativeMovement(this.runtime, direction, options);
    return { ...result, ...(result.started && result.completed && !result.blockedReason
      ? this.completedStep(result.from) : { stopContinuation: false }) };
  }

  turn(turn: DungeonPlayerTurn, options: Parameters<typeof startDungeonPlayerTurn>[2]) {
    return startDungeonPlayerTurn(this.runtime, turn, options);
  }

  update(deltaSeconds: number) {
    const movement = this.runtime.playerMovement;
    const result = updateDungeonPlayerMovement(this.runtime, deltaSeconds);
    const outcome: StepOutcome = result.completed && movement?.kind === 'move'
      ? this.completedStep(movement.from, movement.requestId) : { stopContinuation: false };
    return { ...result, ...outcome };
  }
}
