import type { CombatCharacter } from './characters/character.ts';
import type { CombatRecord } from './records/combatRecord.ts';
import { createTurnPhase, type TurnPhaseState } from './turns/turnPhase.ts';

/** 以我方视角保存的战斗结果。 */
export type BattleResult = {
  /** 胜利、失败、平局或逃离。 */
  outcome: 'victory' | 'defeat' | 'draw' | 'escaped';
  /** 可选的结束原因，例如击败敌人或剧情结束。 */
  reason?: string;
};

/** 一场战斗的完整运行状态；轮数与阶段沿用 TurnPhaseState。 */
export type BattleState = TurnPhaseState & {
  /** 本场战斗唯一标识，与结算记录的 battleId 对应。 */
  id: string;
  /** 待开始、进行中或已结束，防止重复开始与结束后继续推进。 */
  status: 'ready' | 'active' | 'finished';
  /** 所有参战角色，包括我方、敌人与中立单位，数组顺序不代表行动顺序。 */
  characters: CombatCharacter[];
  /** 战斗结果；未结束时为 null。 */
  result: BattleResult | null;
  /** 按提交顺序保存的伤害和治疗记录，不含预览或未提交的结算。 */
  records: CombatRecord[];
};

/** 深拷贝参战角色创建待开始状态；不恢复生命、技能次数或冷却。 */
export function createBattleState(id: string, characters: readonly CombatCharacter[]): BattleState {
  if (!id.trim()) throw new Error('战斗 ID 不能为空。');
  const ids = characters.map(character => character.id);
  if (ids.some(value => !value.trim()) || new Set(ids).size !== ids.length) throw new Error('参战角色 ID 必须非空且不重复。');
  return {
    id, ...createTurnPhase(), status: 'ready', result: null,
    characters: structuredClone([...characters]).map(character => ({ ...character, actions: { normal: 0, extra: 0 } })),
    records: [],
  };
}

/** 保存本阶段已结算记录；只记账，不重复应用伤害和治疗。整批校验通过后才返回新状态。 */
export function appendBattleRecords(state: BattleState, records: readonly CombatRecord[]): BattleState {
  if (state.status !== 'active') throw new Error('只有进行中的战斗可以提交记录。');
  const ids = new Set(state.records.map(record => record.id));
  for (const record of records) {
    if (record.battleId !== state.id || record.round !== state.round || record.phase !== state.phase) throw new Error('结算记录不属于当前战斗阶段。');
    if (!record.id.trim() || ids.has(record.id)) throw new Error('结算记录 ID 不能为空或重复。');
    if (!state.characters.some(character => character.id === record.targetId)) throw new Error('结算目标不在参战角色中。');
    ids.add(record.id);
  }
  const next = structuredClone(state);
  next.records.push(...structuredClone([...records]));
  return next;
}
