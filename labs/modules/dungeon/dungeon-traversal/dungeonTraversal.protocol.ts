import type { DungeonTraversalChange } from '@/core/dungeon-traversal';
import { createLabEvent } from '@/labs/kit';

export const dungeonTraversalChangedEvent = createLabEvent<Readonly<{
  loadId: number;
  sequence: number;
  change: DungeonTraversalChange;
}>>('dungeon.traversal.changed');
