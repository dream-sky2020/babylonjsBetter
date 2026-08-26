import { PHYSICS_COMPONENT_FIELD_SCHEMA, type IPhysicsComponent } from '../../map/dungeonMap.physics';
import { createEntityDataId } from '../entity.utils';
import type { ComponentDefinition } from '../entity.types';

/** 兼容现有存档的通行规则组件定义；后续可通过 version/migrate 平滑改名。 */
export const componentDefinition: ComponentDefinition<IPhysicsComponent> = {
  type: 'physics',
  version: 1,
  label: '通行规则',
  description: '方向、身份标签和动态条件组成的声明式通行规则。',
  allowMultiple: false,
  fields: PHYSICS_COMPONENT_FIELD_SCHEMA,
  createDefault: () => ({
    id: createEntityDataId('component'),
    type: 'physics',
    version: 1,
    directionMode: 'all',
  }),
};
