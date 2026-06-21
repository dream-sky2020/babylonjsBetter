import type { ClashContext, DiceRollResult, UnitId } from './types.ts';
import { applyDamage } from './clash-logic-applyDamage.ts';
import { buildBattleContext, clampUnitHpToMax, getUnitElement } from './utils/combat-utils.ts';

type MutableClashContext = ClashContext & Record<string, unknown>;

function getSideLabel(unitId: UnitId): '左' | '右' {
  return unitId === 'A' || unitId === 'left' ? '左' : '右';
}

function getDisplayName(unitId: UnitId): string {
  const side = getSideLabel(unitId);
  const unit = getUnitElement(unitId);
  const unitName = unit?.getData().name?.trim();
  return `${side}${unitName ? `(${unitName})` : ''}`;
}

function startClash(): void {
  clampUnitHpToMax('A');
  clampUnitHpToMax('B');
  const battle = buildBattleContext();
  const displayA = getDisplayName('A');
  const displayB = getDisplayName('B');
  const skillA = window.buildSkillData('A');
  const skillB = window.buildSkillData('B');
  if (!skillA || !skillB) {
    window.log('拼点失败：请先在左右阵营各选择一个技能');
    return;
  }
  const resultA = rollFromDice('A');
  const resultB = rollFromDice('B');
  if (!resultA || !resultB) {
    window.log(`拼点失败：${displayA} 或 ${displayB} 的所选技能骰子配置为空`);
    return;
  }

  window.log(`${displayA} 使用技能: ${skillA.skillName || skillA.skillId}`);
  window.log(`${displayB} 使用技能: ${skillB.skillName || skillB.skillId}`);

  const statusA = window.buildStatusConfig('A');
  const statusB = window.buildStatusConfig('B');
  window.log(`${displayA} 特殊状态: ${statusA.map((status) => `${status.type}(层${status.stack},强${status.power})`).join(' | ')}`);
  window.log(`${displayB} 特殊状态: ${statusB.map((status) => `${status.type}(层${status.stack},强${status.power})`).join(' | ')}`);

  window.log(`${displayA} 投掷了 ${resultA.length} 个骰子:`);
  resultA.forEach((result, index) => window.log(`  #${index + 1}: ${result.die.min}~${result.die.max} → ${result.roll}`));
  window.log(`${displayB} 投掷了 ${resultB.length} 个骰子:`);
  resultB.forEach((result, index) => window.log(`  #${index + 1}: ${result.die.min}~${result.die.max} → ${result.roll}`));

  const sumRollA = processClashRolls('A', resultA, battle);
  const sumRollB = processClashRolls('B', resultB, battle);

  window.log(`${displayA} 全部骰子结算点数: ${resultA.map((result) => result.finalRoll).join(' + ')} = ${sumRollA}`);
  window.log(`${displayB} 全部骰子结算点数: ${resultB.map((result) => result.finalRoll).join(' + ')} = ${sumRollB}`);
  window.log(`最终拼点: ${displayA}(${sumRollA}) vs ${displayB}(${sumRollB})`);

  if (sumRollA > sumRollB) {
    window.log(`🎉 ${displayA} 胜出`);
    applyDamage('A', 'B', resultA);
  } else if (sumRollB > sumRollA) {
    window.log(`🎉 ${displayB} 胜出`);
    applyDamage('B', 'A', resultB);
  } else {
    window.log('⚖️ 平局！骰子互相抵消');
  }
}

function processClashRolls(unitId: UnitId, results: DiceRollResult[], battle: ClashContext['battle']): number {
  let totalSum = 0;
  const currentSkillEffects = window.buildSkillEffectConfig(unitId);
  const opponentId: UnitId = unitId === 'A' ? 'B' : 'A';

  results.forEach((result, index) => {
    let ctx: MutableClashContext = {
      unitId,
      attackerId: unitId,
      targetId: opponentId,
      coinIndex: index,
      baseRoll: result.roll,
      currentRoll: result.roll,
      skillEffects: currentSkillEffects,
      battle,
    };

    const bleed = window.consumeStatus(unitId, 'bleed');
    if (bleed) {
      window.dealDirectHpDamage(unitId, bleed.power, '流血(拼点)');
    }

    ctx = window.combatEngine.trigger('onBeforeClash', ctx) as MutableClashContext;

    totalSum += ctx.currentRoll;
    result.finalRoll = ctx.currentRoll;
  });

  return totalSum;
}

function rollFromDice(unitId: UnitId): DiceRollResult[] | null {
  const dice = window.buildDiceConfig(unitId).filter((die) => Number.isFinite(die.min) && Number.isFinite(die.max));
  if (dice.length === 0) return null;

  return dice.map((die) => {
    const low = Math.min(die.min, die.max);
    const high = Math.max(die.min, die.max);
    const roll = Math.floor(Math.random() * (high - low + 1)) + low;
    return { die, roll };
  });
}

window.startClash = startClash;

export { startClash };
