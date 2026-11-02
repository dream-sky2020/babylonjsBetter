import type { CombatCharacter } from './characters/character.ts';
import { advanceTurnPhase, phaseForFaction } from './turns/turnPhase.ts';
import type { BattleResult, BattleState } from './battleState.ts';

/** 可替换的流程规则，不写入可序列化的战斗状态。 */
export type BattleFlowRules = {
  /** 角色是否可行动；默认生命大于 0，可自行加入眩晕等限制。 */
  canAct?: (character: Readonly<CombatCharacter>) => boolean;
  /** 胜负判定；返回 null 继续战斗，可替换为剧情或其他目标规则。 */
  evaluateResult?: (state: Readonly<BattleState>) => BattleResult | null;
};

/** 默认歼灭规则：中立单位不参与胜负；双方均无存活角色为平局。 */
export function evaluateEliminationResult(state: Readonly<BattleState>): BattleResult | null {
  const alliesAlive = state.characters.some(character => character.faction === 'ally' && character.stats.hp > 0);
  const enemiesAlive = state.characters.some(character => character.faction === 'enemy' && character.stats.hp > 0);
  if (!alliesAlive && !enemiesAlive) return { outcome: 'draw' };
  if (!alliesAlive) return { outcome: 'defeat' };
  if (!enemiesAlive) return { outcome: 'victory' };
  return null;
}

/** 查询当前阶段仍有正常或额外行动的角色，保留存储顺序，不替调用方排序。 */
export function getPhaseActors(state: BattleState, rules: BattleFlowRules = {}): CombatCharacter[] {
  if (state.status !== 'active') return [];
  return state.characters.filter(character =>
    phaseForFaction(character.faction) === state.phase &&
    (rules.canAct ?? (actor => actor.stats.hp > 0))(character) &&
    (character.actions.normal > 0 || character.actions.extra > 0));
}

/** 显式结束战斗，例如逃跑、剧情胜利；清空剩余行动，保留角色和记录。 */
export function finishBattle(state: BattleState, result: BattleResult): BattleState {
  if (state.status !== 'active') throw new Error('只有进行中的战斗可以结束。');
  const next = structuredClone(state);
  next.status = 'finished';
  next.result = structuredClone(result);
  for (const character of next.characters) character.actions = { normal: 0, extra: 0 };
  return next;
}

/** 在行动结算及记录提交后调用；战斗已结束时返回独立快照。 */
export function checkBattleResult(state: BattleState, rules: BattleFlowRules = {}): BattleState {
  if (state.status === 'ready') throw new Error('战斗尚未开始。');
  if (state.status === 'finished') return structuredClone(state);
  const result = (rules.evaluateResult ?? evaluateEliminationResult)(state);
  return result ? finishBattle(state, result) : structuredClone(state);
}

/** 进入阶段时只给本阶段可行动角色分配行动，其余角色清零；不推进任何计时。 */
function allocatePhaseActions(state: BattleState, rules: BattleFlowRules): void {
  for (const character of state.characters) {
    const eligible = phaseForFaction(character.faction) === state.phase &&
      (rules.canAct ?? (actor => actor.stats.hp > 0))(character);
    const normal = character.actionDefinition.normalActionsPerTurn;
    if (!Number.isSafeInteger(normal) || normal < 0) throw new Error('正常行动次数必须为非负安全整数。');
    character.actions = { normal: eligible ? normal : 0, extra: 0 };
  }
}

/** 从我方第 1 轮开始；先检查胜负，仍需战斗时分配我方行动。 */
export function startBattle(state: BattleState, rules: BattleFlowRules = {}): BattleState {
  if (state.status !== 'ready') throw new Error('战斗不能重复开始。');
  const next = structuredClone(state);
  next.status = 'active';
  const checked = checkBattleResult(next, rules);
  if (checked.status === 'active') allocatePhaseActions(checked, rules);
  return checked;
}

/** 当前阶段结束后进入下一阶段；提前结束必须显式指定 endEarly。空阶段不会自动循环跳过。 */
export function endBattlePhase(state: BattleState, options: { endEarly?: boolean } = {}, rules: BattleFlowRules = {}): BattleState {
  if (state.status !== 'active') throw new Error('只有进行中的战斗可以切换阶段。');
  const next = checkBattleResult(state, rules);
  if (next.status === 'finished') return next;
  if (!options.endEarly && getPhaseActors(next, rules).length > 0) throw new Error('当前阶段还有角色可以行动。');
  Object.assign(next, advanceTurnPhase(next));
  allocatePhaseActions(next, rules);
  return next;
}
