import { createServiceToken } from '../system-runtime/ServiceToken.ts';
import type { DungeonMovementResolver } from './dungeonMovementResolver.ts';

type Capability = Pick<DungeonMovementResolver, 'updateConfig' | 'subscribe' | 'debugActiveMoves'>;
export type DungeonMovementControl = {
  updateConfig(loadId: number, next: Parameters<Capability['updateConfig']>[0]): boolean;
  debugActiveMoves(loadId: number): ReturnType<Capability['debugActiveMoves']>;
  subscribe(loadId: number, listener: Parameters<Capability['subscribe']>[0]): () => void;
};
export const DUNGEON_MOVEMENT_CONTROL_SERVICE_KEY = createServiceToken<DungeonMovementControl>('dungeon:movement-control');
export const createDungeonMovementControl = (read: () => { loadId: number; resolver: Capability } | null): DungeonMovementControl => ({
  updateConfig(loadId, next) {
    const current = read();
    if (!current || current.loadId !== loadId) return false;
    current.resolver.updateConfig(next); return true;
  },
  debugActiveMoves(loadId) {
    const current = read();
    return current?.loadId === loadId ? current.resolver.debugActiveMoves() : [];
  },
  subscribe(loadId, listener) {
    const current = read();
    if (!current || current.loadId !== loadId) return () => {};
    return current.resolver.subscribe(change => {
      const active = read();
      if (active?.loadId === loadId && active.resolver === current.resolver) listener(change);
    });
  },
});
