import { createLabEvent } from '@/tools/lab-kit';

export const dungeonAgentsLoadedEvent = createLabEvent<Readonly<{
  loadId: number;
  agentCount: number;
}>>('dungeon.agents.loaded');

export const dungeonAgentsChangedEvent = createLabEvent<Readonly<{
  loadId: number;
  entityIds: readonly string[];
  reason: 'manual-move-started' | 'manual-turn-started' | 'movement-completed';
}>>('dungeon.agents.changed');
