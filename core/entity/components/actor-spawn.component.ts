import { createEntityDataId } from '../entity.utils.ts';
import type { ComponentDefinition, IComponent } from '../entity.types';

/** 角色出生声明；位置由 Entity 的 tile 空间挂载表达。 */
export interface IActorSpawnComponent extends IComponent {
  type: 'actor-spawn';
}

export const componentDefinition: ComponentDefinition<IActorSpawnComponent> = {
  type: 'actor-spawn',
  version: 1,
  label: '角色出生声明',
  description: '声明角色出生于此实体挂载的格子。',
  allowedEntityTypes: ['spawn-point'],
  batch: { scope: 'same-kind', create: true, edit: true, delete: true },
  fields: [],
  createDefault: () => ({
    id: createEntityDataId('component'),
    type: 'actor-spawn',
    version: 1,
  }),
  validate: (component) => {
    const errors: string[] = [];
    if ('tileX' in component || 'tileY' in component) errors.push('出生位置必须由 tile 空间挂载表达，不能保存 tileX/tileY。');
    return errors;
  },
};
