export type DungeonMovementAttemptOutcome = 'claimed' | 'swap-started' | 'push-started' | 'blocked' | 'arbitration-rejected';

let nextAttemptId = 0;
export const createDungeonMovementAttemptId = (): number => ++nextAttemptId;

export const isDungeonMovementArbitrationRejection = (reason: string | undefined): boolean =>
  reason === 'reservation-conflict' || reason === 'priority-conflict' || reason === 'movement-in-progress';
