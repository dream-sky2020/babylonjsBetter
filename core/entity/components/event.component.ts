import { createEntityDataId } from '../entity.utils';
import type { ComponentDefinition, IComponent } from '../entity.types';

export interface IEventComponent extends IComponent {
  type: 'event';
  trigger: string;
  actionId: string;
  once?: boolean;
  payload?: Record<string, unknown>;
}

export const componentDefinition: ComponentDefinition<IEventComponent> = {
  type: 'event', version: 1, label: '事件响应', description: '声明触发时机与业务动作 ID。', allowMultiple: true,
  allowedEntityTypes: ['map', 'tile', 'tile-edge', 'shared-edge', 'shared-point'],
  batch: { scope: 'compatible', create: true, delete: true },
  fields: [
    { path: 'trigger', label: '触发时机', control: 'text', placeholder: 'interact' },
    { path: 'actionId', label: '动作 ID', control: 'text', placeholder: 'open_door' },
    { path: 'once', label: '仅触发一次', control: 'checkbox', optional: true },
    { path: 'payload', label: '业务载荷 JSON', control: 'json', optional: true },
  ],
  createDefault: () => ({ id: createEntityDataId('component'), type: 'event', version: 1, trigger: 'interact', actionId: '' }),
};
