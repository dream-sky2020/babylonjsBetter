import { createEntityDataId, type ComponentDefinition, type IComponent } from '@/core/entity';

export interface IInitialDungeonLoadComponent extends IComponent {
  type: 'initial-dungeon-load';
  dungeonPresetKey: string;
}

export const componentDefinition: ComponentDefinition<IInitialDungeonLoadComponent> = {
  type: 'initial-dungeon-load',
  version: 1,
  label: '首次地牢加载',
  description: '指定世界首次进入时加载的地牢预设。世界只保存引用，不持有地牢内容。',
  allowedEntityTypes: ['initial-dungeon'],
  allowMultiple: false,
  fields: [{
    path: 'dungeonPresetKey',
    label: '地牢预设 Key',
    control: 'text',
    placeholder: '例如 dungeon_map',
  }],
  createDefault: () => ({
    id: createEntityDataId('initial-dungeon-load'),
    type: 'initial-dungeon-load',
    version: 1,
    enabled: true,
    dungeonPresetKey: 'dungeon_map',
  }),
  validate: (component) => component.dungeonPresetKey.trim()
    ? []
    : ['地牢预设 Key 不能为空。'],
};
