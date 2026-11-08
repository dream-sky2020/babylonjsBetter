import type { DungeonPlayerMovementAttemptResolution, DungeonPlayerMovementResult } from '@/core/dungeon-player-movement';

export const PLAYER_MOVEMENT_BLOCKED_ATTEMPT_SERVICE_KEY = 'dungeon:player-movement-blocked-attempt';

export type DungeonPlayerBlockedAttempt = DungeonPlayerMovementResult & Readonly<{
  blockedReason: 'map-boundary' | 'movement-obstacle';
  attemptId?: number;
}>;

export type DungeonPlayerBlockedAttemptInterceptor = (
  attempt: DungeonPlayerBlockedAttempt,
) => boolean;

export type DungeonPlayerBlockedAttemptService = Readonly<{
  register(interceptor: DungeonPlayerBlockedAttemptInterceptor): () => void;
  tryHandle(attempt: DungeonPlayerBlockedAttempt): boolean;
  observe(listener: (attempt: DungeonPlayerMovementAttemptResolution) => void): () => void;
  publish(attempt: DungeonPlayerMovementAttemptResolution): void;
}>;

export const createDungeonPlayerBlockedAttemptService = (): DungeonPlayerBlockedAttemptService => {
  const interceptors = new Set<DungeonPlayerBlockedAttemptInterceptor>();
  const listeners = new Set<(attempt: DungeonPlayerMovementAttemptResolution) => void>();
  return {
    register(interceptor) {
      interceptors.add(interceptor);
      return () => interceptors.delete(interceptor);
    },
    tryHandle(attempt) {
      return [...interceptors].some((interceptor) => interceptor(attempt));
    },
    observe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
    publish(attempt) { listeners.forEach(listener => listener(attempt)); },
  };
};
