import { createServiceToken } from '../system-runtime/ServiceToken.ts';
import type { DungeonTraversalWorld } from './dungeonTraversal.ts';

type TraversalCapability = Pick<DungeonTraversalWorld, 'inspectStep' | 'subscribe'>;
export type DungeonTraversalControl = {
  inspectStep(loadId: number, ...args: Parameters<TraversalCapability['inspectStep']>): ReturnType<TraversalCapability['inspectStep']> | null;
  subscribe(loadId: number, listener: Parameters<TraversalCapability['subscribe']>[0]): () => void;
};
export const DUNGEON_TRAVERSAL_CONTROL_SERVICE_KEY = createServiceToken<DungeonTraversalControl>('dungeon:traversal-control');

/** Binds capabilities to the active Session; stale callbacks/commands cannot cross a map switch. */
export const createDungeonTraversalControl = (
  read: () => { loadId: number; traversal: TraversalCapability } | null,
): DungeonTraversalControl => ({
  inspectStep(loadId, ...args) {
    const current = read();
    return current?.loadId === loadId ? current.traversal.inspectStep(...args) : null;
  },
  subscribe(loadId, listener) {
    const current = read();
    if (!current || current.loadId !== loadId) return () => {};
    return current.traversal.subscribe(change => {
      const active = read();
      if (active?.loadId === loadId && active.traversal === current.traversal) listener(change);
    });
  },
});
