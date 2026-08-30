import { createEntityDataId } from '../entity.utils';
import type { ComponentDefinition, IComponent } from '../entity.types';

/** 角色在地牢地图格子坐标中的出生位置。 */
export interface IActorSpawnComponent extends IComponent {
  type: 'actor-spawn';
  tileX: number;
  tileY: number;
}

export const componentDefinition: ComponentDefinition<IActorSpawnComponent> = {
  type: 'actor-spawn',
  version: 1,
  label: '角色出生声明',
  description: '声明角色出生时所在的地图格子坐标。',
  allowedEntityTypes: ['spawn-point'],
  batch: { scope: 'same-kind', create: true, edit: true, delete: true },
  fields: [
    { path: 'tileX', label: '出生格 X', control: 'number', min: 0, step: 1, batch: { editable: true } },
    { path: 'tileY', label: '出生格 Y', control: 'number', min: 0, step: 1, batch: { editable: true } },
  ],
  createDefault: () => ({
    id: createEntityDataId('component'),
    type: 'actor-spawn',
    version: 1,
    tileX: 0,
    tileY: 0,
  }),
  validate: (component) => {
    const errors: string[] = [];
    if (!Number.isInteger(component.tileX) || component.tileX < 0) errors.push('tileX 必须是非负整数。');
    if (!Number.isInteger(component.tileY) || component.tileY < 0) errors.push('tileY 必须是非负整数。');
    return errors;
  },
};
