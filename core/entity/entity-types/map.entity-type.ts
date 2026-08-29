import type { EntityTypeDefinition } from '../entity.types';

export const entityTypeDefinition: EntityTypeDefinition = {
  type: 'map',
  label: '地图实体',
  description: '地图大场景环境引用；只允许挂载 scene-environment 组件。',
  allowedContainers: ['map'],
  batch: { scope: 'same-kind', create: true, delete: true },
  defaultComponents: ['scene-environment'],
  allowMultiplePerContainer: true,
};
