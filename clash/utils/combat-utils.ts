// utils/combat-utils.ts
import type { SkillEffectConfig, UnitId, ClashContext, HitContext, BattleContext } from '../types.ts';

type MutableContext = (ClashContext | HitContext) & Record<string, unknown>;

function getSelectedUnitByCamp(camp: 'left' | 'right', allUnits: UnitInputElement[]): UnitInputElement | null {
  const selectedCard = document.querySelector(
    `#unit-list-${camp} unit-card.selected[data-unit-id]`
  ) as HTMLElement | null;
  const selectedCardUnitId = selectedCard?.getAttribute('data-unit-id');
  if (selectedCardUnitId) {
    const matchedById = allUnits.find((unit) => unit.getUnitId() === selectedCardUnitId);
    if (matchedById) return matchedById;
  }

  // 详情面板中当前展示的就是被选中的单位，作为兜底来源。
  const fromEditor = document.querySelector(`#editor-container-${camp} unit-input`) as UnitInputElement | null;
  if (fromEditor) return fromEditor;

  // 兼容旧逻辑：如果 unit-input 本身仍维护 selected class。
  return allUnits.find((unit) => unit.classList.contains('selected') && unit.closest(`#camp-${camp}`)) || null;
}

export function getUnitElement(unitId: UnitId): UnitInputElement | null {
  const allUnits = Array.from(document.querySelectorAll('unit-input')) as UnitInputElement[];
  if (unitId === 'A' || unitId === 'left') {
    return getSelectedUnitByCamp('left', allUnits);
  }
  if (unitId === 'B' || unitId === 'right') {
    return getSelectedUnitByCamp('right', allUnits);
  }
  return allUnits.find(u => u.getUnitId() === unitId) || null;
}

export function buildBattleContext(): BattleContext {
  const readCamp = (camp: 'left' | 'right'): UnitId[] => {
    return Array.from(document.querySelectorAll(`#unit-list-${camp} unit-card[data-unit-id]`))
      .map((card) => card.getAttribute('data-unit-id')?.trim() || '')
      .filter((id): id is UnitId => id.length > 0);
  };

  return {
    leftCamp: readCamp('left'),
    rightCamp: readCamp('right'),
    turnCount: 1,
  };
}

export function clampUnitHpToMax(unitId: UnitId): void {
  const unit = getUnitElement(unitId);
  if (!unit) return;

  const data = unit.getData();
  const safeMaxHp = Math.max(1, Number(data.maxHp) || 1);
  const safeHp = Math.max(0, Math.min(Number(data.hp) || 0, safeMaxHp));
  const safeMaxSanity = Math.max(0, Number(data.maxSanity) || 0);
  const safeSanity = Math.max(0, Math.min(Number(data.sanity) || 0, safeMaxSanity));
  if (safeMaxHp !== data.maxHp || safeHp !== data.hp || safeMaxSanity !== data.maxSanity || safeSanity !== data.sanity) {
    unit.setValues({ maxHp: safeMaxHp, hp: safeHp, maxSanity: safeMaxSanity, sanity: safeSanity });
    const card = document.querySelector(`unit-card[data-unit-id="${unit.getUnitId()}"]`) as { setData: (data: unknown) => void } | null;
    if (card) card.setData(unit.getData());
  }
}

export function applyOrUpdateStatus(unitId: UnitId, type: string, powerToAdd: number, stackToSet = 1): void {
  // Get the unit element
  const unit = getUnitElement(unitId);

  if (!unit) return;
// ...

  const data = unit.getData();
  const statusList = data.status;
  const existing = statusList.find(s => s.type === type);

  if (existing) {
    existing.power += powerToAdd;
    existing.stack += stackToSet;
    unit.setValues({ status: statusList });
    window.log(`  🔄 更新 ${data.name || unitId} 的 ${type} 状态: 强度 +${powerToAdd}, 层数 +${stackToSet}`);
  } else {
    statusList.push({ type, power: powerToAdd, stack: stackToSet });
    unit.setValues({ status: statusList });
    window.log(`  ✅ 为 ${data.name || unitId} 添加了新状态: ${type} (强度: ${powerToAdd})`);
  }
}

export function processSkillEffects(ctx: MutableContext, currentTiming: string): void {
  const effects = Array.isArray(ctx.skillEffects) ? (ctx.skillEffects as SkillEffectConfig[]) : [];
  if (effects.length === 0) return;

  effects.forEach((effect) => {
    if (!effect || effect.timing !== currentTiming) return;

    switch (effect.type) {
      case 'dmg':
        // ✅ 适配新的 DamageInstance 架构
        if ('damageInstances' in ctx && Array.isArray(ctx.damageInstances) && ctx.damageInstances.length > 0) {
          // 默认将增伤加到第一个伤害实例的固定修正值上
          ctx.damageInstances[0].modifierFlat += (effect.value || 0);
          window.log(`  💥 [技能效果] 基础攻击附加伤害 +${effect.value ?? 0}`);
        } else {
          // 兼容之前的逻辑（如果某些阶段没有 damageInstances）
          ctx.damage = (Number(ctx.damage) || 0) + (effect.value || 0);
          window.log(`  💥 [技能效果] 追加伤害 +${effect.value ?? 0}`);
        }
        break;
      case 'applyStatus': {
        const targetId = effect.target === 'self' ? (ctx.attackerId as UnitId) : (ctx.targetId as UnitId);
        applyOrUpdateStatus(targetId, effect.statusId ?? '', effect.power ?? 0, effect.stack ?? 0);
        window.log(`  ✨ [技能效果] 对 ${targetId} 赋予 [${effect.statusId ?? ''}] (强度+${effect.power ?? 0})`);
        break;
      }
      case 'heal': {
        const healTargetId = effect.target === 'enemy' ? (ctx.targetId as UnitId) : (ctx.attackerId as UnitId);
        const currentHp = window.getVal('hp' + healTargetId);
        const maxHp = Math.max(1, window.getVal('maxHp' + healTargetId) || currentHp || 1);
        const value = effect.value || 0;
        const newHp = Math.min(maxHp, currentHp + value);
        window.setVal('hp' + healTargetId, newHp);
        window.log(`  💚 [技能效果] 恢复生命值 +${value} (HP: ${currentHp} → ${newHp})`);
        break;
      }
      default:
        console.warn(`[CombatEngine] 未知的技能效果类型: ${effect.type}`);
    }
  });
}