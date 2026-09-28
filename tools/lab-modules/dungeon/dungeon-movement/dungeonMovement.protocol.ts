import type { DungeonMovementChange } from '@/core/dungeon-movement';
import { createLabEvent } from '@/tools/lab-kit';

export const dungeonMovementChangedEvent = createLabEvent<Readonly<{
  loadId: number;
  sequence: number;
  change: DungeonMovementChange;
}>>('dungeon.movement.changed');
