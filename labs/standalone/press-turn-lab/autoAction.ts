import { otherSide, type Action, type Battle, type Skill, type Unit } from './types.ts';
import { playerContext } from './playerContext.ts';

type Choice = { action: Action; reason: string; score: number };
function expectedDamage(actor: Unit, target: Unit, skill: Skill): number {
  const affinity = skill.element === 'almighty' ? 'normal' : target.affinities[skill.element];
  if (['null', 'repel', 'drain'].includes(affinity)) return -1;
  const damage = Math.max(1, Math.floor(Math.max(1, skill.power + actor.attack - target.defense) * (affinity === 'weak' ? 1.5 : affinity === 'resist' ? .5 : 1) * (target.guarding ? .5 : 1)));
  return Math.min(target.hp, damage) + (affinity === 'weak' ? 60 : 0) + (damage >= target.hp ? 50 : 0);
}

// Deterministic one-step policy; resolution still uses the shared engine and roll mode.
export function chooseAutoAction(battle: Battle): Choice | undefined {
  const { actor, finished } = playerContext(battle);
  if (!actor || finished || battle.icons.full + battle.icons.half <= 0) return;
  const choices: Choice[] = [];
  for (const skill of actor.skills) {
    if (skill.mpCost > actor.mp) continue;
    const pool = battle.teams[skill.kind === 'heal' ? battle.side : otherSide(battle.side)].filter(unit => unit.hp > 0);
    const groups = skill.target === 'all' ? [pool] : pool.map(unit => [unit]);
    for (const targets of groups) {
      if (!targets.length) continue;
      let score = 0;
      let reason: string;
      if (skill.kind === 'heal') {
        const healing = targets.map(unit => Math.max(0, Math.min(unit.maxHp - unit.hp, skill.power)));
        if (!healing.some(value => value > 0)) continue;
        score = healing.reduce((sum, value) => sum + value, 0);
        if (targets.some((unit, index) => unit.hp / unit.maxHp < .5 && healing[index] > 0)) score += 200;
        reason = '治疗受伤队员';
      } else {
        if (skill.accuracy <= 0) continue;
        const values = targets.map(unit => expectedDamage(actor, unit, skill));
        if (values.some(value => value < 0)) continue;
        score = values.reduce((sum, value) => sum + value, 0) * skill.accuracy / 100;
        reason = targets.some(unit => skill.element !== 'almighty' && unit.affinities[skill.element] === 'weak') ? '利用目标弱点' : '选择有效伤害';
      }
      choices.push({ action: { kind: 'skill', actorId: actor.id, skillId: skill.id, targetId: targets[0].id }, reason, score: score - skill.mpCost * .1 });
    }
  }
  choices.sort((a, b) => b.score - a.score);
  return choices[0] ?? { action: { kind: 'pass', actorId: actor.id }, reason: '没有可用的安全技能，选择让过', score: 0 };
}
