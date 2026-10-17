import { equippedSkills } from './preparation.ts';
import { basicAttack } from './data.ts';
import { otherSide, type Action, type Battle } from './types.ts';

export type PlayerAction = Exclude<Action['kind'], 'pass'>;
export const ACTION_NAMES: Record<PlayerAction, string> = { attack: '普通攻击', skill: '技能', guard: '防御', swap: '换手', skip: '空过', prepare: '整备', escape: '逃跑', talk: '对话', observe: '观察' };
export const ACTION_HINTS: Record<PlayerAction, string> = { attack: '选择攻击目标', skill: '选择技能与目标', guard: '承伤减半', swap: '指定存活队友', skip: '按顺序轮转', prepare: '更换装备与技能', escape: '撤离并结束战斗', talk: '选择对话对象', observe: '查看敌方情报' };

export function actionContext(battle: Battle, kind?: PlayerAction, skillId?: string, targetId?: string) {
  const actor = battle.teams[battle.side].find(unit => unit.id === battle.actorId && unit.hp > 0);
  const skills = actor ? equippedSkills(actor).filter(skill => skill.kind !== 'passive') : [];
  const skill = kind === 'attack' && actor ? basicAttack(actor) : kind === 'skill' ? skills.find(item => item.id === skillId) ?? skills[0] : undefined;
  const targetSide = kind === 'swap' || skill?.kind === 'heal' ? battle.side : otherSide(battle.side);
  const targets = kind === 'swap' || kind === 'talk' || kind === 'observe' || !!skill ? battle.teams[targetSide].filter(unit => unit.hp > 0 && (kind !== 'swap' || unit.id !== actor?.id)) : [];
  const target = targets.find(unit => unit.id === targetId) ?? targets[0];
  const finished = !!battle.winner || !!battle.escapedBy || !battle.teams.left.some(unit => unit.hp > 0) || !battle.teams.right.some(unit => unit.hp > 0);
  const canConfirm = !!kind && !!actor && !finished && battle.icons.full + battle.icons.half > 0 && (kind === 'guard' || kind === 'skip' || kind === 'prepare' || kind === 'escape' || (kind === 'swap' || kind === 'talk' || kind === 'observe' ? !!target : !!skill && actor.mp >= skill.mpCost && targets.length > 0));
  return { actor, skills, skill, targetSide, targets, target, finished, canConfirm };
}
