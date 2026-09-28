import type { DungeonTraversalChange } from '@/core/dungeon-traversal';
import { createLabEvent } from '@/tools/lab-kit';

export const dungeonTraversalChangedEvent = createLabEvent<Readonly<{
  loadId: number;
  sequence: number;
  change: DungeonTraversalChange;
}>>('dungeon.traversal.changed');
