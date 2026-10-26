import type { BattlefieldDistanceStripeRuleLibrary, MonsterDistanceStripeRule } from '@/core/monster/visual/MonsterDistanceStripeRules';
import { defineMonsterState, monsterRecord, monsterNumber } from '../monsterModuleState';
export type MonsterDistanceStripeSettings = { enabled: boolean; presetKey: string; rules: MonsterDistanceStripeRule[] };
export const MONSTER_DISTANCE_STRIPE_SETTINGS = defineMonsterState<MonsterDistanceStripeSettings>('monster.distance-stripes.settings', '怪物距离条纹设置',
  () => ({ enabled: false, presetKey: '', rules: [] }), (value): value is MonsterDistanceStripeSettings => {
    if (!monsterRecord(value) || typeof value.enabled !== 'boolean' || typeof value.presetKey !== 'string' || !Array.isArray(value.rules) || value.rules.length > 100) return false;
    const ids = new Set<string>();
    return value.rules.every(rule => {
      if (!monsterRecord(rule) || typeof rule.id !== 'string' || !rule.id || ids.has(rule.id)) return false;
      ids.add(rule.id); return monsterNumber(rule.startRow, 1, 101) && Number.isInteger(rule.startRow) && typeof rule.monsterStripePresetKey === 'string' && !!rule.monsterStripePresetKey;
    });
  });
export const MONSTER_DISTANCE_STRIPE_LIBRARY = defineMonsterState<BattlefieldDistanceStripeRuleLibrary | null>('monster.distance-stripes.library', '怪物距离条纹规则库', () => null,
  (value): value is BattlefieldDistanceStripeRuleLibrary | null => value === null || monsterRecord(value));
