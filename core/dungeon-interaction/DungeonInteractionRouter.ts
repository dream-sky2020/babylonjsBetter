import { createServiceToken } from '../system-runtime/ServiceToken.ts';
import type { DungeonMapDirection } from '../map/dungeonMap.types.ts';
import type { DungeonMovementDirection } from '../dungeon-movement/dungeonMovement.direction.ts';
import { DUNGEON_PLAYER_TRAVERSAL_ACTOR_ID } from '../dungeon-traversal/index.ts';
import type { IEventComponent } from '../entity/components/event.component.ts';
export type InteractionQuery = {
  loadId: number; trigger: 'interact' | 'enter' | 'move-attempt';
  position: { tileX: number; tileY: number }; facing: DungeonMapDirection;
  from?: { tileX: number; tileY: number };
  movementDirection?: DungeonMovementDirection;
  actorId?: string;
  blockingEntityIds?: readonly string[];
  movementPhase?: 'contact' | 'blocked';
  attemptId?: number;
  playerRules?: readonly IEventComponent[];
};
export const isAgentInteraction = (query: InteractionQuery): boolean =>
  !!query.actorId && query.actorId !== DUNGEON_PLAYER_TRAVERSAL_ACTOR_ID;
export type InteractionCandidate = {
  id: string; entityId: string; label: string; priority: number; rank: number;
  stopMovement?: boolean;
  execute(): void | Promise<void>;
};
export type InteractionProvider = {
  id: string; blocked?(): boolean;
  acceptsAgents?: boolean;
  acceptsBlockedMovement?: boolean;
  /** Optional read-only diagnostic; once ownership remains with the executor. */
  isConsumed?(loadId: number, componentId: string): boolean;
  find(query: InteractionQuery): readonly InteractionCandidate[];
};
/** One synchronous selection per trigger; execution stays with the owning feature. */
export class DungeonInteractionRouter {
  private providers = new Map<string, InteractionProvider>();
  private listeners = new Set<() => void>();
  private epoch = 0;
  private disposed = false;
  private state = { busy: false, target: '', error: '' };
  register(provider: InteractionProvider): () => void {
    if (this.disposed || this.providers.has(provider.id)) throw new Error(`交互提供者无效或重复：${provider.id}`);
    this.providers.set(provider.id, provider); return () => { this.providers.delete(provider.id); };
  }
  inspect() { return { ...this.state }; }
  isConsumed(loadId: number, componentId: string): boolean {
    return [...this.providers.values()].some(provider => provider.isConsumed?.(loadId, componentId) === true);
  }
  subscribe(listener: () => void): () => void { this.listeners.add(listener); return () => this.listeners.delete(listener); }
  private notify() { this.listeners.forEach(listener => listener()); }
  dispatch(query: InteractionQuery): boolean {
    if (this.disposed) return false;
    const notifyBlocked = query.movementPhase === 'blocked';
    const independent = isAgentInteraction(query) || notifyBlocked;
    if (!independent && this.state.busy) return true;
    if (query.trigger === 'enter' && (!query.from || query.from.tileX === query.position.tileX && query.from.tileY === query.position.tileY)) return false;
    const epoch = this.epoch;
    try {
      const providers = [...this.providers.values()].filter(provider => notifyBlocked
        ? provider.acceptsBlockedMovement : !independent || provider.acceptsAgents);
      if (providers.some(provider => provider.blocked?.())) return !independent;
      const choices = providers.flatMap(provider => provider.find(query))
        .sort((a, b) => b.priority - a.priority || a.rank - b.rank || a.id.localeCompare(b.id));
      if (!choices.length) return false;
      if (notifyBlocked) {
        for (const candidate of choices) candidate.execute();
        return true;
      }
      const best = choices[0];
      if (choices[1]?.priority === best.priority && choices[1]?.rank === best.rank) throw new Error(`交互目标优先级冲突：${best.label}、${choices[1].label}。请调整优先级。`);
      if (independent) {
        const result = best.execute();
        if (result) void result.catch(error => {
          if (!this.disposed && epoch === this.epoch) {
            this.state.error = error instanceof Error ? error.message : String(error);
            this.notify();
          }
        });
        return true;
      }
      this.state = { busy: true, target: best.label, error: '' }; this.notify();
      const result = best.execute();
      if (!result) {
        this.state.busy = false;
        this.notify();
        return query.trigger === 'interact' || best.stopMovement !== false;
      }
      void Promise.resolve(result).catch(error => {
        if (!this.disposed && epoch === this.epoch) this.state.error = error instanceof Error ? error.message : String(error);
      }).finally(() => { if (!this.disposed && epoch === this.epoch) { this.state.busy = false; this.notify(); } });
      return query.trigger === 'interact' || best.stopMovement !== false;
    } catch (error) {
      this.state = { ...this.state, busy: independent && this.state.busy, error: error instanceof Error ? error.message : String(error) }; this.notify();
      return !independent;
    }
  }
  reset() { this.epoch++; this.state = { busy: false, target: '', error: '' }; this.notify(); }
  dispose() { this.disposed = true; this.epoch++; this.providers.clear(); this.listeners.clear(); }
}
export type DungeonInteractionService = Pick<DungeonInteractionRouter, 'register' | 'dispatch' | 'inspect' | 'subscribe' | 'isConsumed'>;
export const DUNGEON_INTERACTION_SERVICE = createServiceToken<DungeonInteractionService>('dungeon:interaction');
