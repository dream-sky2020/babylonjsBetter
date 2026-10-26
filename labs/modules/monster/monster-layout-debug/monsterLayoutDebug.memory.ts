import { defineMonsterState, monsterRecord } from '../monsterModuleState';
export const MONSTER_LAYOUT_SETTINGS = defineMonsterState<{ visible: boolean }>('monster.layout.settings', '怪物布局辅助设置', () => ({ visible: false }),
  (value): value is { visible: boolean } => monsterRecord(value) && typeof value.visible === 'boolean');
