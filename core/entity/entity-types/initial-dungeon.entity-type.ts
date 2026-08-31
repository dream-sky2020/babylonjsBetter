import type { EntityTypeDefinition } from '@/core/entity';

export const entityTypeDefinition: EntityTypeDefinition = {
  type: 'initial-dungeon',
  label: '首次地牢加载实体',
  description: '世界级入口实体，用于决定世界初始化完成后首次加载哪个地牢。',
  allowedContainers: ['world'],
  defaultComponents: ['initial-dungeon-load'],
  requiredComponents: ['initial-dungeon-load'],
  allowMultiplePerContainer: false,
};
