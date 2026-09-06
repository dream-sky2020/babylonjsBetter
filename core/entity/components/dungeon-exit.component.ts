import { createEntityDataId } from '../entity.utils';
import type { ComponentDefinition, IComponent } from '../entity.types';

export type DungeonExitActivation = 'enter' | 'interact';

export interface IDungeonExitComponent extends IComponent {
  type: 'dungeon-exit';
  /** 目标地图预设 Key，而不是地图内部 ID。 */
  targetMapPresetKey: string;
  /** 目标地图内唯一的 DungeonEntranceComponent.entranceId。 */
  targetEntranceId: string;
  activation: DungeonExitActivation;
}

export const componentDefinition: ComponentDefinition<IDungeonExitComponent> = {
  type: 'dungeon-exit',
  version: 1,
  label: '地牢出口',
  description: '声明格子传送点或边/门通向的目标地图入口。',
  allowedEntityTypes: ['dungeon-exit'],
  batch: { scope: 'same-kind', create: true, edit: true, delete: true },
  fields: [
    { path: 'targetMapPresetKey', label: '目标地图预设 Key', control: 'text', placeholder: '例如 dungeon_map_2', batch: { editable: true } },
    { path: 'targetEntranceId', label: '目标入口 ID', control: 'text', placeholder: '例如 north-gate', batch: { editable: true } },
    {
      path: 'activation', label: '触发方式', control: 'select', batch: { editable: true },
      options: [
        { value: 'enter', label: '进入格子 / 穿过边时' },
        { value: 'interact', label: '主动交互时' },
      ],
    },
  ],
  createDefault: () => ({
    id: createEntityDataId('component'),
    type: 'dungeon-exit',
    version: 1,
    targetMapPresetKey: '',
    targetEntranceId: '',
    activation: 'enter',
  }),
  validate: (component) => {
    const errors: string[] = [];
    if (!component.targetMapPresetKey.trim()) errors.push('targetMapPresetKey 不能为空。');
    if (!component.targetEntranceId.trim()) errors.push('targetEntranceId 不能为空。');
    if (component.activation !== 'enter' && component.activation !== 'interact') {
      errors.push('activation 必须是 enter 或 interact。');
    }
    return errors;
  },
};
