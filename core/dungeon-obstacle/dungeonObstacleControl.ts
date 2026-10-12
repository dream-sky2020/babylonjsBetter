import { createServiceToken } from '../system-runtime/ServiceToken.ts';

/** Commands/subscriptions remain capabilities; obstacle data lives in shared memory. */
export type DungeonObstacleControl = {
  setActive(loadId: number, entityId: string, active: boolean): boolean;
  subscribe(loadId: number, listener: () => void): () => void;
};
export const DUNGEON_OBSTACLE_CONTROL_SERVICE_KEY = createServiceToken<DungeonObstacleControl>('dungeon:obstacle-control');
