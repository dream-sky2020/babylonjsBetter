import { createEntityDataId } from '../entity.utils';
import type { ComponentDefinition, IComponent } from '../entity.types';

export interface IStateComponent extends IComponent {
  type: 'state';
  current: string;
}

export const componentDefinition: ComponentDefinition<IStateComponent> = {
  type: 'state', version: 1, label: '动态状态', description: '门、机关或实体当前所处状态。',
  allowedEntityTypes: ['tile', 'tile-edge', 'shared-edge', 'shared-point'],
  batch: { scope: 'compatible', create: true, edit: true, delete: true },
  fields: [{ path: 'current', label: '当前状态', control: 'text', placeholder: 'closed', batch: { editable: true } }],
  createDefault: () => ({ id: createEntityDataId('component'), type: 'state', version: 1, current: 'default' }),
};
