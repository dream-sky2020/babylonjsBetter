import type { ComponentDefinition, IComponent } from '../entity.types.ts';
import { createEntityDataId } from '../entity.utils.ts';

export type PlayerPushResponse = 'block' | 'push' | 'swap';

export interface ISpatialInteractionComponent extends IComponent {
  type: 'spatial-interaction';
  onPlayerPush: PlayerPushResponse;
}

export const validateSpatialInteraction = (value: ISpatialInteractionComponent): string[] => [
  ...(value.version !== 1 ? ['spatial-interaction version 必须是 1。'] : []),
  ...(!['block', 'push', 'swap'].includes(value.onPlayerPush) ? ['玩家推动响应必须是 block、push 或 swap。'] : []),
];

export const componentDefinition: ComponentDefinition<ISpatialInteractionComponent> = {
  type: 'spatial-interaction', version: 1, label: '空间交互',
  description: '玩家向此物体移动时的响应。推动需要物体可移动且允许推动；换位需要物体可移动。空间不足时仍会受阻。',
  allowedEntityTypes: ['spatial-object', 'obstacle', 'dungeon-agent'],
  allowMultiple: false,
  batch: { scope: 'compatible', create: true, edit: true, delete: true },
  fields: [{
    path: 'onPlayerPush', label: '玩家推动响应', control: 'select',
    options: [{ value: 'block', label: '阻挡' }, { value: 'push', label: '推动' }, { value: 'swap', label: '换位' }],
    batch: { editable: true },
  }],
  createDefault: () => ({ id: createEntityDataId('component'), type: 'spatial-interaction', version: 1, onPlayerPush: 'block' }),
  validate: validateSpatialInteraction,
};
