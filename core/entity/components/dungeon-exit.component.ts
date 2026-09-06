import { createEntityDataId } from '../entity.utils.ts';
import type { ComponentDefinition, IComponent } from '../entity.types.ts';

export type DungeonExitTrigger = 'enter' | 'interact' | 'move-attempt';
/** @deprecated 仅用于读取 v1 地图；新数据使用 triggers。 */
export type DungeonExitActivation = 'enter' | 'interact' | 'both';

export const DUNGEON_EXIT_TRIGGERS: readonly DungeonExitTrigger[] = [
  'enter', 'interact', 'move-attempt',
];

export interface IDungeonExitComponent extends IComponent {
  type: 'dungeon-exit';
  /** 目标地图预设 Key，而不是地图内部 ID。 */
  targetMapPresetKey: string;
  /** 目标地图内唯一的 DungeonEntranceComponent.entranceId。 */
  targetEntranceId: string;
  triggers: DungeonExitTrigger[];
  /** @deprecated v1 兼容字段；保存后的新组件不再写入。 */
  activation?: DungeonExitActivation;
}

export const resolveDungeonExitTriggers = (
  component: Pick<IDungeonExitComponent, 'triggers' | 'activation'>,
): readonly DungeonExitTrigger[] => {
  if (Array.isArray(component.triggers)) {
    return [...new Set(component.triggers.filter((trigger): trigger is DungeonExitTrigger => (
      DUNGEON_EXIT_TRIGGERS.includes(trigger as DungeonExitTrigger)
    )))];
  }
  if (component.activation === 'both') return ['enter', 'interact'];
  if (component.activation === 'enter' || component.activation === 'interact') return [component.activation];
  return [];
};

export const componentDefinition: ComponentDefinition<IDungeonExitComponent> = {
  type: 'dungeon-exit',
  version: 2,
  label: '地牢出口',
  description: '声明格子传送点或边/门通向的目标地图入口。',
  allowedEntityTypes: ['dungeon-exit'],
  batch: { scope: 'same-kind', create: true, edit: true, delete: true },
  fields: [
    { path: 'targetMapPresetKey', label: '目标地图预设 Key', control: 'text', placeholder: '例如 dungeon_map_2', batch: { editable: true } },
    { path: 'targetEntranceId', label: '目标入口 ID', control: 'text', placeholder: '例如 north-gate', batch: { editable: true } },
    {
      path: 'triggers', label: '触发方式（可多选）', control: 'multi-select',
      batch: { editable: true, equality: 'unordered-array' },
      options: [
        { value: 'enter', label: '进入格子 / 成功穿过边时自动触发' },
        { value: 'interact', label: '面向出口按 E 主动触发' },
        { value: 'move-attempt', label: '尝试撞向不可通行的边时触发' },
      ],
    },
  ],
  createDefault: () => ({
    id: createEntityDataId('component'),
    type: 'dungeon-exit',
    version: 2,
    targetMapPresetKey: '',
    targetEntranceId: '',
    triggers: ['enter'],
  }),
  validate: (component) => {
    const errors: string[] = [];
    if (!component.targetMapPresetKey.trim()) errors.push('targetMapPresetKey 不能为空。');
    if (!component.targetEntranceId.trim()) errors.push('targetEntranceId 不能为空。');
    const rawTriggers = component.triggers as unknown;
    if (!Array.isArray(rawTriggers)
      && !['enter', 'interact', 'both'].includes(component.activation ?? '')) {
      errors.push('旧版 activation 或新版 triggers 必须提供一种有效触发方式。');
    } else if (Array.isArray(rawTriggers) && rawTriggers.length === 0) {
      errors.push('triggers 至少需要选择一种触发方式。');
    } else if (Array.isArray(rawTriggers)
      && rawTriggers.some((trigger) => !DUNGEON_EXIT_TRIGGERS.includes(trigger))) {
      errors.push('triggers 包含未知的触发方式。');
    }
    return errors;
  },
  migrate: (data) => {
    const rest = { ...data };
    delete rest.activation;
    return {
      ...rest,
      id: typeof data.id === 'string' ? data.id : createEntityDataId('component'),
      type: 'dungeon-exit',
      version: 2,
      targetMapPresetKey: typeof data.targetMapPresetKey === 'string' ? data.targetMapPresetKey : '',
      targetEntranceId: typeof data.targetEntranceId === 'string' ? data.targetEntranceId : '',
      triggers: [...resolveDungeonExitTriggers(data as unknown as IDungeonExitComponent)],
    };
  },
};
