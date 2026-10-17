import type { ComponentDefinition, IComponent } from '../entity.types.ts';
import { createEntityDataId } from '../entity.utils.ts';

export interface IAgentTimingComponent extends IComponent {
  type: 'agent-timing';
  actionPeriod: number;
  priority: number;
}
export const componentDefinition: ComponentDefinition<IAgentTimingComponent> = {
  type: 'agent-timing', version: 1, label: 'Agent 决策节奏', allowedEntityTypes: ['dungeon-agent'], allowMultiple: false,
  batch: { scope: 'same-kind', create: true, edit: true, delete: true },
  fields: [
    { path: 'actionPeriod', label: '有效玩家格步周期', control: 'number', min: 1, step: 1, batch: { editable: true } },
    { path: 'priority', label: '动作仲裁优先级', control: 'number', step: 1, batch: { editable: true } },
  ],
  createDefault: () => ({ id: createEntityDataId('component'), type: 'agent-timing', version: 1, actionPeriod: 1, priority: 0 }),
  validate: value => [
    ...(!Number.isInteger(value.actionPeriod) || value.actionPeriod < 1 ? ['actionPeriod 必须是正整数。'] : []),
    ...(!Number.isInteger(value.priority) ? ['priority 必须是整数。'] : []),
  ],
};
