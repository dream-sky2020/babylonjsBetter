import type { EntityTypeDefinition } from '../entity.types';

export const entityTypeDefinition: EntityTypeDefinition = {
  type: 'dungeon-exit',
  label: '地牢出口实体',
  description: '通向其他地图入口的传送点、门或边界出口。',
  allowedContainers: ['tile', 'tile-edge', 'shared-edge'],
  batch: { scope: 'compatible', create: true, delete: true },
  defaultComponents: ['dungeon-exit'],
  requiredComponents: ['dungeon-exit'],
  allowMultiplePerContainer: true,
};
