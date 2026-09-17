import { createEntityDataId } from '../entity.utils.ts';
import type { ComponentDefinition, IComponent } from '../entity.types.ts';

export interface IAgentControllerComponent extends IComponent {
  type: 'agent-controller';
  /** 运行时控制器注册表中的稳定 ID，例如 stationary、patrol-route。 */
  controllerId: string;
  /** 控制器拥有并解释的 JSON 配置；核心移动系统不读取其内部字段。 */
  parameters?: Record<string, unknown>;
}

const isRecord = (value: unknown): value is Record<string, unknown> => (
  !!value && typeof value === 'object' && !Array.isArray(value)
);

export const componentDefinition: ComponentDefinition<IAgentControllerComponent> = {
  type: 'agent-controller',
  version: 1,
  label: '行动控制器',
  description: '通过稳定 ID 选择固定、巡逻、追击或其他行动规划器，并保存其静态参数。',
  allowedEntityTypes: ['dungeon-agent'],
  batch: { scope: 'same-kind', create: true, edit: true, delete: true },
  allowMultiple: false,
  fields: [
    {
      path: 'controllerId', label: '控制器 ID', control: 'text',
      placeholder: 'stationary', batch: { editable: true },
    },
    { path: 'parameters', label: '控制器参数 JSON', control: 'json', optional: true },
  ],
  createDefault: () => ({
    id: createEntityDataId('component'),
    type: 'agent-controller',
    version: 1,
    controllerId: 'stationary',
    parameters: {},
  }),
  validate: (component) => {
    const errors: string[] = [];
    if (!component.controllerId.trim()) errors.push('controllerId 不能为空。');
    if (component.parameters !== undefined && !isRecord(component.parameters)) {
      errors.push('parameters 必须是 JSON 对象。');
    }
    return errors;
  },
};
