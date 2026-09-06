import type { DungeonMapDirection } from '../../map/dungeonMap.types';
import { createEntityDataId } from '../entity.utils';
import type { ComponentDefinition, IComponent } from '../entity.types';

export interface IDungeonEntranceComponent extends IComponent {
  type: 'dungeon-entrance';
  /** 单张地图内唯一，作为其他地图出口引用的稳定地址。 */
  entranceId: string;
  /** 玩家抵达该入口后的正式格子朝向。 */
  facing: DungeonMapDirection;
}

export const componentDefinition: ComponentDefinition<IDungeonEntranceComponent> = {
  type: 'dungeon-entrance',
  version: 1,
  label: '地牢入口',
  description: '声明跨地图传送后的格子落点与正式朝向。',
  allowedEntityTypes: ['dungeon-entrance'],
  batch: { scope: 'same-kind', create: true, edit: true, delete: true },
  fields: [
    { path: 'entranceId', label: '入口 ID', control: 'text', placeholder: '例如 south-gate', batch: { editable: true } },
    {
      path: 'facing', label: '抵达后朝向', control: 'select', batch: { editable: true },
      options: [
        { value: 'north', label: '北' },
        { value: 'east', label: '东' },
        { value: 'south', label: '南' },
        { value: 'west', label: '西' },
      ],
    },
  ],
  createDefault: () => ({
    id: createEntityDataId('component'),
    type: 'dungeon-entrance',
    version: 1,
    entranceId: 'entrance',
    facing: 'south',
  }),
  validate: (component) => {
    const errors: string[] = [];
    if (!component.entranceId.trim()) errors.push('entranceId 不能为空。');
    if (!['north', 'east', 'south', 'west'].includes(component.facing)) errors.push('facing 必须是有效的地图方向。');
    return errors;
  },
};
