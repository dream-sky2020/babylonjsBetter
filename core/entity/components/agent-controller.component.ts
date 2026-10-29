import { createEntityDataId } from '../entity.utils.ts';
import type { ComponentDefinition, IComponent } from '../entity.types.ts';

export interface IAgentControllerComponent extends IComponent {
  type: 'agent-controller';
  /** 运行时控制器注册表中的稳定 ID，例如 stationary、patrol-route。 */
  controllerId: string;
  /** 控制器拥有并解释的 JSON 配置；核心移动系统不读取其内部字段。 */
  parameters?: Record<string, unknown>;
  /** Debug 模型颜色；省略时由寻路策略决定。 */
  debugColor?: string;
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
    { path: 'parameters.navigationStrategy', label: '追踪寻路策略', control: 'select', optional: true, options: [
      { value: 'path', label: '完整路径规划' }, { value: 'direct', label: '直接靠近' }, { value: 'wall-follow', label: '靠近并沿墙绕行' },
    ] },
    { path: 'debugColor', label: 'Debug 颜色（#RRGGBB，留空自动）', control: 'text', optional: true, placeholder: '#ff8800' },
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
    if (component.debugColor !== undefined && (typeof component.debugColor !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(component.debugColor))) errors.push('debugColor 必须是 #RRGGBB 格式。');
    const strategy = component.parameters?.navigationStrategy;
    if (component.controllerId === 'chase-player' && strategy !== undefined && !['path', 'direct', 'wall-follow'].includes(strategy as string)) errors.push('追踪寻路策略无效。');
    return errors;
  },
};
