import type { ClashContext, DiceRollResult, UnitId } from './types.ts';
import { applyDamage } from './clash-logic-applyDamage.ts';

type MutableClashContext = ClashContext & Record<string, unknown>;

function startClash(): void {
  const resultA = rollFromDice('A');
  const resultB = rollFromDice('B');
  if (!resultA || !resultB) {
    window.log('拼点失败：A 或 B 的骰子配置为空');
    return;
  }

  const statusA = window.buildStatusConfig('A');
  const statusB = window.buildStatusConfig('B');
  window.log(`A 特殊状态: ${statusA.map((status) => `${status.type}(层${status.stack},强${status.power})`).join(' | ')}`);
  window.log(`B 特殊状态: ${statusB.map((status) => `${status.type}(层${status.stack},强${status.power})`).join(' | ')}`);

  window.log(`A 投掷了 ${resultA.length} 个骰子:`);
  resultA.forEach((result, index) => window.log(`  #${index + 1}: ${result.die.min}~${result.die.max} → ${result.roll}`));
  window.log(`B 投掷了 ${resultB.length} 个骰子:`);
  resultB.forEach((result, index) => window.log(`  #${index + 1}: ${result.die.min}~${result.die.max} → ${result.roll}`));

  const sumRollA = processClashRolls('A', resultA);
  const sumRollB = processClashRolls('B', resultB);

  window.log(`A 全部骰子结算点数: ${resultA.map((result) => result.finalRoll).join(' + ')} = ${sumRollA}`);
  window.log(`B 全部骰子结算点数: ${resultB.map((result) => result.finalRoll).join(' + ')} = ${sumRollB}`);
  window.log(`最终拼点: A(${sumRollA}) vs B(${sumRollB})`);

  if (sumRollA > sumRollB) {
    window.log('🎉 A 胜出');
    applyDamage('A', 'B', resultA);
  } else if (sumRollB > sumRollA) {
    window.log('🎉 B 胜出');
    applyDamage('B', 'A', resultB);
  } else {
    window.log('⚖️ 平局！骰子互相抵消');
  }
}

function processClashRolls(unitId: UnitId, results: DiceRollResult[]): number {
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
  const dice = buildDiceConfig(unitId).filter((die) => Number.isFinite(die.min) && Number.isFinite(die.max));
  if (dice.length === 0) return null;

  return dice.map((die) => {
    const low = Math.min(die.min, die.max);
    const high = Math.max(die.min, die.max);
    const roll = Math.floor(Math.random() * (high - low + 1)) + low;
    return { die, roll };
  });
}

function buildDiceConfig(unitId: UnitId) {
  const list = document.getElementById(`dice-list-${unitId}`);
  if (!list) return [];
  return Array.from(list.querySelectorAll('dice-input')).map((element) => (element as DiceInputElement).getData());
}

window.startClash = startClash;

export { startClash };
