import type { IInitialDungeonLoadComponent, IEntity } from '@/core/entity';
import type { WorldPreset } from './worldPreset.types';

export type InitialDungeonReference = {
  entity: IEntity;
  component: IInitialDungeonLoadComponent;
  dungeonPresetKey: string;
};

export const resolveInitialDungeon = (preset: WorldPreset): InitialDungeonReference => {
  const entities = preset.data.entities.filter(
    (entity) => entity.enabled !== false && entity.entityType === 'initial-dungeon',
  );
  if (entities.length !== 1) {
    throw new Error(`世界“${preset.presetKey}”必须包含且只能包含一个启用的首次地牢加载实体。`);
  }
  const components = entities[0].components.filter(
    (component) => component.enabled !== false && component.type === 'initial-dungeon-load',
  ) as IInitialDungeonLoadComponent[];
  if (components.length !== 1) {
    throw new Error(`世界“${preset.presetKey}”的首次地牢加载实体必须包含且只能包含一个启用的首次地牢加载组件。`);
  }
  const dungeonPresetKey = typeof components[0].dungeonPresetKey === 'string'
    ? components[0].dungeonPresetKey.trim()
    : '';
  if (!dungeonPresetKey) throw new Error(`世界“${preset.presetKey}”的首次地牢预设 Key 不能为空。`);
  return { entity: entities[0], component: components[0], dungeonPresetKey };
};
