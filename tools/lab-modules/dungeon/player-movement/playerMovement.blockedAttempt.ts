import type { DungeonPlayerMovementResult } from '@/core/dungeon-player-movement';

export const PLAYER_MOVEMENT_BLOCKED_ATTEMPT_SERVICE_KEY = 'dungeon:player-movement-blocked-attempt';

export type DungeonPlayerBlockedAttempt = DungeonPlayerMovementResult & Readonly<{
  blockedReason: 'map-boundary' | 'movement-obstacle';
}>;

export type DungeonPlayerBlockedAttemptInterceptor = (
  attempt: DungeonPlayerBlockedAttempt,
) => boolean;

export type DungeonPlayerBlockedAttemptService = Readonly<{
  register(interceptor: DungeonPlayerBlockedAttemptInterceptor): () => void;
  tryHandle(attempt: DungeonPlayerBlockedAttempt): boolean;
}>;

export const createDungeonPlayerBlockedAttemptService = (): DungeonPlayerBlockedAttemptService => {
  const interceptors = new Set<DungeonPlayerBlockedAttemptInterceptor>();
  return {
    register(interceptor) {
      interceptors.add(interceptor);
      return () => interceptors.delete(interceptor);
    },
    tryHandle(attempt) {
      return [...interceptors].some((interceptor) => interceptor(attempt));
    },
  };
};
