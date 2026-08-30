import { createEntityDataId } from '../entity.utils';
import type { ComponentDefinition, IComponent } from '../entity.types';

export interface IMovementObstacleComponent extends IComponent {
  type: 'movement-obstacle';
  /** Runtime 没有覆盖状态时，阻碍是否默认生效。 */
  activeByDefault: boolean;
}

export const componentDefinition: ComponentDefinition<IMovementObstacleComponent> = {
  type: 'movement-obstacle',
  version: 1,
  label: '移动阻碍',
  description: '声明阻碍的初始启用状态；运行时切换不会写回地图预设。',
  allowedEntityTypes: ['obstacle'],
  batch: { scope: 'same-kind', create: true, edit: true, delete: true },
  fields: [
    { path: 'activeByDefault', label: '默认生效', control: 'checkbox', batch: { editable: true } },
  ],
  createDefault: () => ({
    id: createEntityDataId('component'),
    type: 'movement-obstacle',
    version: 1,
    activeByDefault: true,
  }),
  validate: (component) => typeof component.activeByDefault === 'boolean'
    ? []
    : ['activeByDefault 必须是布尔值。'],
};
