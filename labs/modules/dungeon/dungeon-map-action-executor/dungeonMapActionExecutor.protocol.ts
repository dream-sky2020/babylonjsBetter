import { createLabEvent } from '../../../kit/labCommunication.types.ts';
import type { SharedVariableValue } from '@/core/entity/components/shared-variable.component';

export type DungeonMapActionContext = {
  loadId: number; ruleId: string; sourceEntityId: string; actorId: string;
  actorLabel?: string; variableTrace?: readonly string[];
};

type DungeonVariableChanged = DungeonMapActionContext & {
  variableId: string; previous: SharedVariableValue; current: SharedVariableValue;
};

export const dungeonVariableChangedEvent = createLabEvent<DungeonVariableChanged>('dungeon.variable.changed', 1, {
  label: '地图共享变量变化', description: '动作写入成功且值变化后通知。',
  fields: [
    { name: 'loadId', type: 'number', required: true },
    { name: 'variableId', type: 'string', required: true },
    { name: 'previous', type: 'scalar', required: true },
    { name: 'current', type: 'scalar', required: true },
  ],
});
