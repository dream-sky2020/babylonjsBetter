import type { EntityTypeDefinition } from '../entity.types';

export const entityTypeDefinition: EntityTypeDefinition = {
  type: 'shared-point',
  label: '公用点实体',
  description: '一个、两个或四个格子共享的交汇点实体。',
  allowedContainers: ['shared-point'],
  batch: { scope: 'same-kind', create: true, delete: true },
  defaultComponents: ['state', 'visual'],
  allowMultiplePerContainer: true,
};
