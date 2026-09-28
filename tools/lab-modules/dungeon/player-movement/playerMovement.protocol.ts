import { createLabEvent } from '@/tools/lab-kit/labCommunication.types';
import type { DungeonPlayerStepCompleted } from '@/core/dungeon-player-movement/dungeonPlayerStepEvents';

/** Observation only. Required game rules use DungeonPlayerStepEvents synchronously. */
export const dungeonPlayerStepCompletedEvent =
  createLabEvent<DungeonPlayerStepCompleted>('dungeon.player.step-completed');