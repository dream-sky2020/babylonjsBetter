// main.ts
import { clashPipelineEngine, ClashPipelineEngine } from './clash-pipeline-engine.ts';
import { CoinEffectsPipelinePlugin } from './plugins/coin-effects-pipeline.ts';
import { SkillEffectsPipelinePlugin } from './plugins/skill-effects-pipeline.ts';
import { StatusModifiersPipelinePlugin } from './plugins/status-modifiers-pipeline.ts';
import { useCombatStore } from './store.ts';
import type { ClashPayload, UnitConfig } from './types.ts';

// ✅ 导入刚写好的 API 工具
import { initCombatApi, loadInitialData } from './combat-api.ts';

// 1. 初始化全局 API
initCombatApi();

// 2. 注册新管线插件
clashPipelineEngine
  .use(CoinEffectsPipelinePlugin)
  .use(SkillEffectsPipelinePlugin)
  .use(StatusModifiersPipelinePlugin);
window.clashPipelineEngine = clashPipelineEngine;

let turnCount = 1;

type RuntimeSyncField =
  | 'hp'
  | 'maxHp'
  | 'shield'
  | 'tempShield'
  | 'sanity'
  | 'maxSanity'
  | 'chaos'
  | 'chaosThreshold';

const RUNTIME_SYNC_FIELDS: RuntimeSyncField[] = [
  'hp',
  'maxHp',
  'shield',
  'tempShield',
  'sanity',
  'maxSanity',
  'chaos',
  'chaosThreshold',
];

function syncRuntimeUnitState(payload: ClashPayload): void {
  const state = useCombatStore.getState();
  const leftIdSet = new Set(state.leftUnits.map((unit) => unit.id));

  payload.AllUnit.forEach((snapshotUnit) => {
    const liveUnit = state.getUnit(snapshotUnit.id);
    if (!liveUnit) return;

    const patch: Partial<Pick<UnitConfig, RuntimeSyncField>> = {};
    RUNTIME_SYNC_FIELDS.forEach((field) => {
      if (liveUnit[field] !== snapshotUnit[field]) {
        patch[field] = snapshotUnit[field];
      }
    });

    if (Object.keys(patch).length === 0) return;

    const side = leftIdSet.has(snapshotUnit.id) ? 'left' : 'right';
    state.updateUnit(side, snapshotUnit.id, patch as Partial<UnitConfig>);
  });
}

function buildPayloadForSelectedUnits(): ClashPayload | null {
  const state = useCombatStore.getState();
  const leftUnit = state.leftUnits.find((unit) => unit.id === state.selectedLeftUnitId);
  const rightUnit = state.rightUnits.find((unit) => unit.id === state.selectedRightUnitId);

  if (!leftUnit || !rightUnit) {
    window.log('新管线拼点失败：请先选择左右阵营的单位');
    return null;
  }

  const skillA = leftUnit.skills.find((skill) => skill.skillId === leftUnit.activeSkillId);
  const skillB = rightUnit.skills.find((skill) => skill.skillId === rightUnit.activeSkillId);
  if (!skillA || !skillB) {
    window.log('新管线拼点失败：请先为双方选择技能');
    return null;
  }

  if (skillA.dice.length === 0 || skillB.dice.length === 0) {
    window.log('新管线拼点失败：双方出战技能都需要至少 1 个骰子');
    return null;
  }

  const payload = ClashPipelineEngine.createDefaultPayload();
  payload.AllUnit = [...state.leftUnits, ...state.rightUnits];
  payload.LeftUnit = [...state.leftUnits];
  payload.RightUnit = [...state.rightUnits];
  payload.UnitA_selectedForClash = leftUnit;
  payload.UnitB_selectedForClash = rightUnit;
  payload.SkillA_selectedForClash = skillA;
  payload.SkillB_selectedForClash = skillB;
  payload.DicesA_selectedForClash = [...skillA.dice];
  payload.DicesB_selectedForClash = [...skillB.dice];
  payload.turnCount = turnCount;

  return payload;
}

function startClashByPipeline(): void {
  const payload = buildPayloadForSelectedUnits();
  if (!payload) return;
  clashPipelineEngine.run(payload);
  syncRuntimeUnitState(payload);
}

function endTurnByPipeline(): void {
  const state = useCombatStore.getState();
  const payload = ClashPipelineEngine.createDefaultPayload();
  payload.AllUnit = [...state.leftUnits, ...state.rightUnits];
  payload.LeftUnit = [...state.leftUnits];
  payload.RightUnit = [...state.rightUnits];
  payload.turnCount = turnCount;
  clashPipelineEngine.trigger('onTurnEnd', payload);
  syncRuntimeUnitState(payload);
  turnCount += 1;
  window.log(`新管线：回合结束结算完成，进入第 ${turnCount} 回合`);
}

// 3. 统一 UI 入口（React UI 与原生按钮都走新管线）
window.startClash = startClashByPipeline;
window.endTurn = endTurnByPipeline;

// 4. 加载初始数据
loadInitialData();

console.log('✅ 游戏引擎初始化完成，阵营模式已就绪！');
