import { createServiceToken } from '../system-runtime/ServiceToken';
import type { DungeonMapDirection } from '../map';
import type { DungeonRuntimePlayerPosition } from '../dungeon-runtime';

export type DungeonPlayerStepCompleted = Readonly<{
  loadId: number;
  stepId: number;
  from: Readonly<DungeonRuntimePlayerPosition>;
  to: Readonly<DungeonRuntimePlayerPosition>;
  facing: DungeonMapDirection;
  requestId?: string;
}>;

/** Synchronous rule boundary, before the player may continue into another tile.
 * A listener returning true consumes continuation (e.g. a map transition).
 * Exceptions propagate: required rules must not silently fail like Debug observers.
 */
export class DungeonPlayerStepEvents {
  private sequence = 0;
  private listeners = new Map<string, { order: number; run: (event: DungeonPlayerStepCompleted) => boolean | void }>();

  subscribe(id: string, order: number, run: (event: DungeonPlayerStepCompleted) => boolean | void): () => void {
    if (this.listeners.has(id)) throw new Error('重复格步消费者：' + id);
    this.listeners.set(id, { order, run });
    return () => { this.listeners.delete(id); };
  }

  emit(input: Omit<DungeonPlayerStepCompleted, 'stepId'>): { event: DungeonPlayerStepCompleted; stopContinuation: boolean } {
    const event = Object.freeze({ ...input, stepId: ++this.sequence,
      from: Object.freeze({ ...input.from }), to: Object.freeze({ ...input.to }) });
    for (const [, listener] of [...this.listeners].sort((a, b) => a[1].order - b[1].order || a[0].localeCompare(b[0]))) {
      if (listener.run(event) === true) return { event, stopContinuation: true };
    }
    return { event, stopContinuation: false };
  }

  dispose(): void { this.listeners.clear(); }
}

export type DungeonPlayerStepSource = Pick<DungeonPlayerStepEvents, 'subscribe'>;
export const DUNGEON_PLAYER_STEP_SERVICE_KEY = createServiceToken<DungeonPlayerStepSource>('dungeon:player-step-rules');