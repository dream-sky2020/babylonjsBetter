import { AFFINITIES, ELEMENTS, otherSide, sideName, type Action, type Battle, type Icons, type Outcome } from './types.ts';
import { basicAttack } from './data.ts';
import { applyPreparation, ARMORS, combatStats, currentPreparation, equippedSkills, WEAPONS } from './preparation.ts';

// Icons represent actions, not a numeric pool: a half icon still pays for an ordinary action.
export function spendIcons(icons: Icons, outcome: Outcome): Icons {
  const next = { ...icons };
  const consume = () => { if (next.half > 0) next.half--; else if (next.full > 0) next.full--; };
  if (outcome === 'deny') return { full: 0, half: 0 };
  if (outcome === 'advantage' || outcome === 'pass') {
    if (next.full > 0) { next.full--; next.half++; } else consume();
  } else { consume(); if (outcome === 'miss') consume(); }
  return next;
}

function checkWinner(battle: Battle): boolean {
  const left = battle.teams.left.some(u => u.hp > 0), right = battle.teams.right.some(u => u.hp > 0);
  if (left && right) return false;
  battle.winner = left ? 'left' : right ? 'right' : 'draw';
  battle.icons = { full: 0, half: 0 }; battle.actorId = undefined;
  battle.logs.push(battle.winner === 'draw' ? '[战斗结束] 双方全部倒下。' : `[战斗结束] ${sideName(battle.winner)}胜利。`);
  return true;
}

function beginPhase(battle: Battle) {
  battle.teams[battle.side].forEach(unit => { unit.guarding = false; });
  const living = battle.teams[battle.side].filter(unit => unit.hp > 0);
  battle.actorId = living[0]?.id; battle.icons = { full: living.length, half: 0 };
  battle.logs.push(`[阶段 ${battle.phase}] ${sideName(battle.side)}开始：${living.length} 大点 / 0 半点。`);
}
export function endPhase(source: Battle): Battle {
  const battle = structuredClone(source);
  if (battle.escapedBy) return battle;
  if (checkWinner(battle)) return battle;
  if (battle.side === 'right') battle.round++;
  battle.side = otherSide(battle.side); battle.phase++; beginPhase(battle);
  return battle;
}

export function restartBattle(source: Battle): Battle {
  const battle = structuredClone(source);
  Object.values(battle.teams).flat().forEach(unit => { unit.hp = unit.maxHp; unit.mp = unit.maxMp; unit.guarding = false; });
  battle.side = 'left'; battle.round = 1; battle.phase = 1; battle.winner = undefined; battle.last = undefined;
  battle.escapedBy = undefined; battle.report = undefined;
  battle.logs = ['[重开] 按当前配置恢复 HP/MP。'];
  if (!checkWinner(battle)) beginPhase(battle);
  return battle;
}

export function resolveAction(source: Battle, action: Action, random: () => number = Math.random): Battle {
  const battle = structuredClone(source);
  const fail = (message: string) => { battle.logs.push(`[拒绝执行] ${message}`); return battle; };
  if (battle.winner || battle.escapedBy || !battle.teams.left.some(u => u.hp > 0) || !battle.teams.right.some(u => u.hp > 0)) return fail('战斗已结束，请重置测试。');
  const team = battle.teams[battle.side];
  const actor = team.find(unit => unit.id === action.actorId);
  if (!actor || actor.hp <= 0 || actor.id !== battle.actorId) return fail('请选择当前阶段的存活行动者。');
  if (battle.icons.full + battle.icons.half <= 0) return fail('没有可用行动点。');
  const before = { ...battle.icons };
  const details: string[] = [];
  let outcome: Outcome = 'normal';
  if (action.kind === 'prepare') {
    if (!action.preparation || !applyPreparation(actor, action.preparation)) return fail('整备配置无效，请重新选择装备与已有技能。');
    const equipment = currentPreparation(actor);
    details.push(`${actor.name} 完成整备：${WEAPONS[equipment.weaponId].name} / ${ARMORS[equipment.armorId].name}，装备 ${equippedSkills(actor).length} / 8 个技能；消耗一次普通行动。`);
  }
  else if (action.kind === 'escape') { details.push(`${actor.name} 带领${sideName(battle.side)}撤离，战斗结束。`); }
  else if (action.kind === 'talk' || action.kind === 'observe') {
    const target = battle.teams[otherSide(battle.side)].find(unit => unit.id === action.targetId && unit.hp > 0);
    if (!target) return fail('需要选择存活的敌方目标。');
    if (action.kind === 'talk') {
      const message = action.message?.trim().slice(0, 160) || '我们可以谈谈吗？';
      battle.report = { title: `对话 · ${target.name}`, text: `${actor.name}：“${message}”\n${target.name} 保持警戒，暂未改变战斗立场。` };
    } else {
      const equipment = currentPreparation(target);
      battle.report = { title: `观察 · ${target.name}`, text: `HP ${target.hp}/${target.maxHp} · MP ${target.mp}/${target.maxMp}\n攻击 ${combatStats(target).attack} · 防御 ${combatStats(target).defense} · ${target.guarding ? '防御中' : '未防御'}\n装备：${WEAPONS[equipment.weaponId].name} / ${ARMORS[equipment.armorId].name}\n相性：${Object.entries(ELEMENTS).map(([id, name]) => `${name} ${id === 'almighty' ? '普通' : AFFINITIES[target.affinities[id as keyof typeof ELEMENTS]]}`).join(' · ')}\n技能：${[basicAttack(target), ...equippedSkills(target)].map(skill => skill.name).join('、') || '无'}` };
    }
    details.push(`[${battle.report.title}] ${battle.report.text}`);
  }
  else if (action.kind === 'swap') {
    const teammate = team.find(unit => unit.id === action.targetId && unit.id !== actor.id && unit.hp > 0);
    if (!teammate) return fail('换手需要选择另一名存活队友。');
    outcome = 'pass'; details.push(`${actor.name} 换手给 ${teammate.name}。`);
  }
  else if (action.kind === 'pass' || action.kind === 'skip') { outcome = 'pass'; details.push(`${actor.name} 空过行动。`); }
  else if (action.kind === 'guard') { actor.guarding = true; details.push(`${actor.name} 防御：承伤减半，持续到己方下个阶段开始。`); }
  else {
    const skill = action.kind === 'attack' ? basicAttack(actor) : actor.skills.find(item => item.id === action.skillId);
    if (!skill) return fail('没有选中技能。');
    if (action.kind === 'skill' && !equippedSkills(actor).some(item => item.id === skill.id) && skill.id !== `${actor.id}-attack`) return fail('此技能尚未装配，请先整备。');
    if (skill.kind === 'passive') return fail('被动技能自动生效，不能主动执行。');
    if (actor.mp < skill.mpCost) return fail(`MP 不足，需要 ${skill.mpCost}。`);
    const pool = skill.kind === 'heal' ? team : battle.teams[otherSide(battle.side)];
    const targets = skill.target === 'all' ? pool.filter(u => u.hp > 0) : pool.filter(u => u.id === action.targetId && u.hp > 0);
    if (!targets.length) return fail('需要选择有效的存活目标。');
    actor.mp -= skill.mpCost;
    let denied = false, missed = false, advantage = false;
    for (const target of targets) {
      if (skill.kind === 'heal') {
        const healed = Math.min(target.maxHp - target.hp, skill.power); target.hp += healed;
        details.push(`${actor.name} → ${target.name}：${skill.name}，恢复 ${healed} HP。`); continue;
      }
      const affinity = skill.element === 'almighty' ? 'normal' : target.affinities[skill.element];
      // Defensive affinities have precedence over hit/critical debugging rolls.
      if (!['null', 'repel', 'drain'].includes(affinity) && (action.forced === 'miss' || ((action.forced ?? 'random') === 'random' && random() * 100 >= skill.accuracy))) {
        missed = true; details.push(`${actor.name} → ${target.name}：${skill.name} 未命中。`); continue;
      }
      const critical = !['null', 'repel', 'drain'].includes(affinity) && (action.forced === 'critical' || ((action.forced ?? 'random') === 'random' && random() * 100 < skill.critical));
      const base = Math.max(1, skill.power + combatStats(actor).attack - combatStats(target).defense);
      let damage = Math.max(1, Math.floor(base * (affinity === 'weak' ? 1.5 : affinity === 'resist' ? .5 : 1) * (critical ? 1.5 : 1) * (target.guarding ? .5 : 1)));
      let result = '';
      if (affinity === 'null') { denied = true; damage = 0; result = '无效，0 伤害'; }
      else if (affinity === 'repel') { denied = true; damage = Math.max(1, Math.floor(base * (actor.guarding ? .5 : 1))); actor.hp = Math.max(0, actor.hp - damage); result = `反射，${actor.name} 受到 ${damage} 伤害（不递归反射）`; }
      else if (affinity === 'drain') { denied = true; const heal = Math.min(target.maxHp - target.hp, damage); target.hp += heal; result = `吸收，恢复 ${heal} HP`; }
      else { target.hp = Math.max(0, target.hp - damage); advantage ||= affinity === 'weak' || critical; result = `${AFFINITIES[affinity]}${critical ? ' / 暴击' : ''}，${damage} 伤害`; }
      details.push(`${actor.name} → ${target.name}：${skill.name} [${ELEMENTS[skill.element]}] ${result}。`);
    }
    outcome = denied ? 'deny' : missed ? 'miss' : advantage ? 'advantage' : 'normal';
  }
  battle.icons = spendIcons(before, outcome);
  battle.last = { outcome, before, after: { ...battle.icons }, details };
  battle.logs.push(...details, `[行动点] ${before.full}大/${before.half}半 → ${battle.icons.full}大/${battle.icons.half}半`);
  if (action.kind === 'escape') { battle.escapedBy = battle.side; battle.icons = { full: 0, half: 0 }; battle.actorId = undefined; return battle; }
  if (checkWinner(battle)) return battle;
  const index = team.findIndex(unit => unit.id === actor.id);
  battle.actorId = action.kind === 'swap' ? action.targetId : [...team.slice(index + 1), ...team.slice(0, index + 1)].find(unit => unit.hp > 0)?.id;
  return battle.icons.full + battle.icons.half === 0 ? endPhase(battle) : battle;
}
