import { createEntityDataId } from '../entity.utils.ts';
import type { ComponentDefinition, IComponent } from '../entity.types.ts';

/** Orientation for non-body grid entities. Actors and bodies own their live facing. */
export interface IGridFacingComponent extends IComponent {
  type: 'grid-facing'; facing: 'north' | 'east' | 'south' | 'west';
}
export const componentDefinition: ComponentDefinition<IGridFacingComponent> = {
  type: 'grid-facing', version: 1, label: '格子朝向',
  description: '为没有空间物体的固定实体声明朝向；NPC 和空间物体使用自身运行时朝向。',
  allowedEntityTypes: ['interaction-point', 'tile', 'tile-edge', 'shared-edge'], allowMultiple: false,
  fields: [{ path: 'facing', label: '正面朝向', control: 'select', options: [
    { value: 'north', label: '北' }, { value: 'east', label: '东' }, { value: 'south', label: '南' }, { value: 'west', label: '西' },
  ] }],
  createDefault: () => ({ id: createEntityDataId('component'), type: 'grid-facing', version: 1, facing: 'south' }),
  validate: value => value.version === 1 && ['north', 'east', 'south', 'west'].includes(value.facing) ? [] : ['格子朝向必须为有效的四方向，版本必须为 1。'],
};
