// utils/combat-utils.ts
import { useCombatStore } from '../store.ts';
import type { UnitId, UnitConfig } from '../types.ts';
import { log } from '../combat-api.ts';

export function getUnitElement(unitId: UnitId) {
  const state = useCombatStore.getState();
  const unit = state.getUnit(unitId);
  if (!unit) return null;

  return {
    getData: () => unit,
    setValues: (updates: Partial<UnitConfig>) => {
      const side = state.leftUnits.some(u => u.id === unit.id) ? 'left' : 'right';
      state.updateUnit(side, unit.id, updates);
    },
    getUnitId: () => unit.id
  };
}

export function clampUnitHpToMax(unitId: UnitId): void {
  const state = useCombatStore.getState();
  const unit = state.getUnit(unitId);
  if (!unit) return;

  const safeMaxHp = Math.max(1, Number(unit.maxHp) || 1);
  const safeHp = Math.max(0, Math.min(Number(unit.hp) || 0, safeMaxHp));
  const safeMaxSanity = Math.max(0, Number(unit.maxSanity) || 0);
  const safeSanity = Math.max(0, Math.min(Number(unit.sanity) || 0, safeMaxSanity));
  
  if (safeMaxHp !== unit.maxHp || safeHp !== unit.hp || safeMaxSanity !== unit.maxSanity || safeSanity !== unit.sanity) {
    const side = state.leftUnits.some(u => u.id === unit.id) ? 'left' : 'right';
    state.updateUnit(side, unit.id, { maxHp: safeMaxHp, hp: safeHp, maxSanity: safeMaxSanity, sanity: safeSanity });
  }
}

export function applyOrUpdateStatus(unitId: UnitId, type: string, powerToAdd: number, stackToSet = 1): void {
  const state = useCombatStore.getState();
  const unit = state.getUnit(unitId);

  if (!unit) return;

  const statusList = [...unit.status];
  const existing = statusList.find(s => s.type === type);

  if (existing) {
    existing.power += powerToAdd;
    existing.stack += stackToSet;
    const side = state.leftUnits.some(u => u.id === unit.id) ? 'left' : 'right';
    state.updateUnit(side, unit.id, { status: statusList });
    log(`  🔄 更新 ${unit.name || unitId} 的 ${type} 状态: 强度 +${powerToAdd}, 层数 +${stackToSet}`);
  } else {
    statusList.push({ type, power: powerToAdd, stack: stackToSet });
    const side = state.leftUnits.some(u => u.id === unit.id) ? 'left' : 'right';
    state.updateUnit(side, unit.id, { status: statusList });
    log(`  ✅ 为 ${unit.name || unitId} 添加了新状态: ${type} (强度: ${powerToAdd})`);
  }
}


