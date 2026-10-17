import { otherSide, type Battle } from './types.ts';

// Resolve both the displayed target and the submitted target from the same live data.
export function playerContext(battle: Battle, targetId?: string) {
  const actor = battle.teams[battle.side].find(unit => unit.id === battle.actorId && unit.hp > 0);
  const skill = actor?.skills.find(item => item.id === actor.skillId);
  const targetSide = skill?.kind === 'heal' ? battle.side : otherSide(battle.side);
  const targets = battle.teams[targetSide].filter(unit => unit.hp > 0);
  const target = targets.find(unit => unit.id === targetId) ?? targets[0];
  const finished = !!battle.winner || !!battle.escapedBy || !battle.teams.left.some(unit => unit.hp > 0) || !battle.teams.right.some(unit => unit.hp > 0);
  return { actor, skill, targetSide, targets, target, finished };
}
