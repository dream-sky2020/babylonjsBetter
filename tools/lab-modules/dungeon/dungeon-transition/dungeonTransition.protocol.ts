import { createLabEvent } from '@/tools/lab-kit';

export type DungeonTransitionEventPayload = Readonly<{
  sourcePresetKey: string;
  targetPresetKey: string;
  targetEntranceId: string;
  exitEntityId: string;
}>;

export const dungeonTransitionStartedEvent = createLabEvent<DungeonTransitionEventPayload>(
  'dungeon.transition.started',
);

export const dungeonTransitionCompletedEvent = createLabEvent<DungeonTransitionEventPayload>(
  'dungeon.transition.completed',
);

export const dungeonTransitionFailedEvent = createLabEvent<DungeonTransitionEventPayload & Readonly<{
  message: string;
}>>('dungeon.transition.failed');
