import { STATUS_TYPES } from './config.ts';
import './editor/dice-editor.ts';
import './editor/skill-effect-item.ts';
import './editor/status-editor.ts';
import './editor/unit-editor.ts';
import './editor/unit-card.ts';
import './clash-logic-engine.ts';
import './clash-logic-startClash.ts';
import './editor/skill-card.ts';
import './editor/skill-editor.ts';
import type { DiceConfig, SkillData, SkillEffectConfig, StatusConfig, UnitId, UnitConfig } from './types.ts';

// ✅ 导入你的插件
import { CoinEffectsPlugin } from './plugins/coin-effects.ts';
import { SkillEffectsPlugin } from './plugins/skill-effects.ts';
import { StatusModifiersPlugin } from './plugins/status-modifiers.ts';

import { getUnitElement } from './utils/combat-utils.ts';

let selectedUnitLeft: UnitInputElement | null = null;
let selectedUnitRight: UnitInputElement | null = null;
type SkillEditorElement = HTMLElement & {
  setSkillId: (id: string) => void;
  getSkillId: () => string;
  setValues: (data: Partial<SkillData>) => void;
  getData: () => SkillData;
};

type SkillCardElement = HTMLElement & {
  setData: (data: Partial<SkillData>) => void;
};

let selectedSkillIdLeft: string | null = null;
let selectedSkillIdRight: string | null = null;
let activeSkillEditorLeft: SkillEditorElement | null = null;
let activeSkillEditorRight: SkillEditorElement | null = null;

function getCampByUnitId(unitId: UnitId): 'left' | 'right' {
  return unitId === 'A' || unitId === 'left' ? 'left' : 'right';
}

function getSelectedUnitByCamp(camp: 'left' | 'right'): UnitInputElement | null {
  return camp === 'left' ? selectedUnitLeft : selectedUnitRight;
}

function getSelectedSkillIdByCamp(camp: 'left' | 'right'): string | null {
  return camp === 'left' ? selectedSkillIdLeft : selectedSkillIdRight;
}

function setSelectedSkillIdByCamp(camp: 'left' | 'right', skillId: string | null): void {
  if (camp === 'left') {
    selectedSkillIdLeft = skillId;
  } else {
    selectedSkillIdRight = skillId;
  }
}

function getActiveSkillEditorByCamp(camp: 'left' | 'right'): SkillEditorElement | null {
  return camp === 'left' ? activeSkillEditorLeft : activeSkillEditorRight;
}

function setActiveSkillEditorByCamp(camp: 'left' | 'right', editor: SkillEditorElement | null): void {
  if (camp === 'left') {
    activeSkillEditorLeft = editor;
  } else {
    activeSkillEditorRight = editor;
  }
}

function updateUnitCard(unit: UnitInputElement): void {
  const card = document.querySelector(`unit-card[data-unit-id="${unit.getUnitId()}"]`) as { setData?: (data: UnitConfig) => void } | null;
  if (card?.setData) {
    card.setData(unit.getData());
  }
}

function persistActiveSkill(camp: 'left' | 'right'): void {
  const unit = getSelectedUnitByCamp(camp);
  const editor = getActiveSkillEditorByCamp(camp);
  if (!unit || !editor) return;

  const latestSkill = editor.getData();
  const unitData = unit.getData();
  const nextSkills = (unitData.skills ?? []).map((skill) => (skill.skillId === latestSkill.skillId ? latestSkill : skill));
  unit.setValues({ skills: nextSkills, activeSkillId: latestSkill.skillId });
  updateUnitCard(unit);
}

function renderSkillEditor(camp: 'left' | 'right'): void {
  const container = document.getElementById(`skill-editor-container-${camp}`);
  const unit = getSelectedUnitByCamp(camp);
  if (!container || !unit) return;

  const unitData = unit.getData();
  const selectedSkillId = getSelectedSkillIdByCamp(camp);
  const selectedSkill = (unitData.skills ?? []).find((skill) => skill.skillId === selectedSkillId);
  if (!selectedSkill) {
    setActiveSkillEditorByCamp(camp, null);
    container.innerHTML = '';
    return;
  }

  const editor = document.createElement('skill-editor') as SkillEditorElement;
  editor.setSkillId(selectedSkill.skillId);
  editor.setValues(selectedSkill);
  editor.addEventListener('remove-skill', () => {
    const currentUnit = getSelectedUnitByCamp(camp);
    if (!currentUnit) return;
    const currentData = currentUnit.getData();
    const remaining = (currentData.skills ?? []).filter((item) => item.skillId !== selectedSkill.skillId);
    currentUnit.setValues({ skills: remaining, activeSkillId: remaining[0]?.skillId });
    updateUnitCard(currentUnit);
    setSelectedSkillIdByCamp(camp, remaining[0]?.skillId ?? null);
    renderSkillsPanel(camp);
    updateSelectionUI();
  });

  setActiveSkillEditorByCamp(camp, editor);
  container.innerHTML = '';
  container.appendChild(editor);
}

function renderSkillsPanel(camp: 'left' | 'right'): void {
  const list = document.getElementById(`skill-list-${camp}`);
  const container = document.getElementById(`skill-editor-container-${camp}`);
  const unit = getSelectedUnitByCamp(camp);
  if (!list || !container) return;

  list.innerHTML = '';
  if (!unit) {
    setSelectedSkillIdByCamp(camp, null);
    setActiveSkillEditorByCamp(camp, null);
    container.innerHTML = '';
    return;
  }

  const unitData = unit.getData();
  const skills = unitData.skills ?? [];
  if (skills.length === 0) {
    setSelectedSkillIdByCamp(camp, null);
    setActiveSkillEditorByCamp(camp, null);
    unit.setValues({ activeSkillId: undefined });
    updateUnitCard(unit);
    container.innerHTML = '';
    return;
  }

  const currentSelectedId = getSelectedSkillIdByCamp(camp);
  const preferredSkillId = currentSelectedId ?? unitData.activeSkillId ?? null;
  const hasCurrent = skills.some((skill) => skill.skillId === preferredSkillId);
  const selectedId = hasCurrent ? preferredSkillId : skills[0].skillId;
  setSelectedSkillIdByCamp(camp, selectedId);
  unit.setValues({ activeSkillId: selectedId ?? undefined });
  updateUnitCard(unit);

  skills.forEach((skillData) => {
    const card = document.createElement('skill-card') as SkillCardElement;
    card.setAttribute('data-skill-id', skillData.skillId);
    card.setData(skillData);
    if (skillData.skillId === selectedId) {
      card.classList.add('selected');
    }
    card.addEventListener('click', () => {
      persistActiveSkill(camp);
      setSelectedSkillIdByCamp(camp, skillData.skillId);
      renderSkillsPanel(camp);
      updateSelectionUI();
    });
    list.appendChild(card);
  });

  renderSkillEditor(camp);
}

function log(msg: string): void {
  const logElement = document.getElementById('gameLog');
  if (!logElement) return;
  logElement.innerHTML += `<div>> ${msg}</div>`;
  logElement.scrollTop = logElement.scrollHeight;
}

function getVal(id: string): number {
  const match = id.match(/^(hp|maxHp|shd|tempShd|san|maxSan|chaos|chaosThreshold)(.*)$/);
  if (match) {
    const [_, field, unitId] = match;
    const unit = getUnitElement(unitId);
    if (!unit) return 0;
    const data = unit.getData();
    const fieldMap: Record<string, keyof UnitConfig> = {
      hp: 'hp',
      maxHp: 'maxHp',
      shd: 'shield',
      tempShd: 'tempShield',
      san: 'sanity',
      maxSan: 'maxSanity',
      chaos: 'chaos',
      chaosThreshold: 'chaosThreshold'
    };
    return Number(data[fieldMap[field]]) || 0;
  }
  return 0;
}

function setVal(id: string, val: number): void {
  const match = id.match(/^(hp|maxHp|shd|tempShd|san|maxSan|chaos|chaosThreshold)(.*)$/);
  if (match) {
    const [_, field, unitId] = match;
    const unit = getUnitElement(unitId);
    if (!unit) return;
    const fieldMap: Record<string, keyof UnitConfig> = {
      hp: 'hp',
      maxHp: 'maxHp',
      shd: 'shield',
      tempShd: 'tempShield',
      san: 'sanity',
      maxSan: 'maxSanity',
      chaos: 'chaos',
      chaosThreshold: 'chaosThreshold'
    };
    const targetField = fieldMap[field];
    const patch: Partial<UnitConfig> = { [targetField]: val } as Partial<UnitConfig>;
    const currentData = unit.getData();

    if (targetField === 'maxHp') {
      const nextMaxHp = Math.max(1, Number(val) || 1);
      patch.maxHp = nextMaxHp;
      if (currentData.hp > nextMaxHp) {
        patch.hp = nextMaxHp;
      }
    } else if (targetField === 'maxSanity') {
      const nextMaxSanity = Math.max(0, Number(val) || 0);
      patch.maxSanity = nextMaxSanity;
      if (currentData.sanity > nextMaxSanity) {
        patch.sanity = nextMaxSanity;
      }
    } else if (targetField === 'hp') {
      const maxHp = Math.max(1, Number(currentData.maxHp) || 1);
      patch.hp = Math.max(0, Math.min(Number(val) || 0, maxHp));
    } else if (targetField === 'sanity') {
      const maxSanity = Math.max(0, Number(currentData.maxSanity) || 0);
      patch.sanity = Math.max(0, Math.min(Number(val) || 0, maxSanity));
    }

    unit.setValues(patch);

    updateUnitCard(unit);
  }
}

function buildStatusConfig(unitId: UnitId): StatusConfig[] {
  const unit = getUnitElement(unitId);
  return unit ? unit.getData().status : [];
}

function buildSkillEffectConfig(unitId: UnitId): SkillEffectConfig[] {
  const skill = buildSkillData(unitId);
  return skill ? skill.skillEffects : [];
}

function buildSkillData(unitId: UnitId): SkillData | null {
  const camp = getCampByUnitId(unitId);
  persistActiveSkill(camp);
  const unit = getSelectedUnitByCamp(camp);
  if (!unit) return null;

  const selectedSkillId = getSelectedSkillIdByCamp(camp) ?? unit.getData().activeSkillId ?? null;
  if (!selectedSkillId) return null;
  return (unit.getData().skills ?? []).find((skill) => skill.skillId === selectedSkillId) ?? null;
}

function buildDiceConfig(unitId: UnitId): DiceConfig[] {
  const skill = buildSkillData(unitId);
  return skill?.dice ?? [];
}

function getStatusLabel(typeId: string): string {
  const match = STATUS_TYPES.find((status) => status.id === typeId);
  return match ? match.label : typeId;
}

function consumeStatus(unitId: UnitId, typeId: string): { type: string; label: string; power: number; prevStack: number; nextStack: number } | null {
  const unit = getUnitElement(unitId);
  if (!unit) return null;

  const data = unit.getData();
  const statusList = data.status;
  const index = statusList.findIndex(s => s.type === typeId && s.stack > 0);

  if (index === -1) return null;

  const status = statusList[index];
  const prevStack = status.stack;
  const nextStack = Math.max(0, prevStack - 1);

  status.stack = nextStack;
  unit.setValues({ status: statusList });

  return {
    type: typeId,
    label: getStatusLabel(typeId),
    power: status.power,
    prevStack,
    nextStack,
  };
}

function dealDirectHpDamage(unitId: UnitId, amount: number, reason: string): number {
  const damage = Math.max(0, Math.floor(amount) || 0);
  if (damage <= 0) return 0;

  const unit = getUnitElement(unitId);
  if (!unit) return 0;

  const data = unit.getData();
  const oldHp = data.hp;
  const newHp = Math.max(0, oldHp - damage);
  const actual = oldHp - newHp;

  unit.setValues({ hp: newHp });
  log(`${data.name || unitId} 触发${reason}，受到 ${actual} 点状态伤害 (HP: ${oldHp} → ${newHp})`);

  if (newHp <= 0) {
    log(`💀 ${data.name || unitId} 已阵亡！`);
  }
  return actual;
}

function endTurn(): void {
  log('=== 回合结束结算 ===');
  if (selectedUnitLeft) {
    const burn = consumeStatus('left', 'burn');
    if (burn) dealDirectHpDamage('left', burn.power, '烧伤(回合结束)');
  }
  if (selectedUnitRight) {
    const burn = consumeStatus('right', 'burn');
    if (burn) dealDirectHpDamage('right', burn.power, '烧伤(回合结束)');
  }
  log('=== 回合结束结算完毕 ===');
}

function updateSelectionUI() {
  persistActiveSkill('left');
  persistActiveSkill('right');

  renderSkillsPanel('left');
  renderSkillsPanel('right');

  const statusEl = document.getElementById('selection-status');
  if (!statusEl) return;

  const leftName = selectedUnitLeft ? selectedUnitLeft.getData().name : '未选择';
  const rightName = selectedUnitRight ? selectedUnitRight.getData().name : '未选择';
  const leftSkillName = buildSkillData('left')?.skillName || '未选择技能';
  const rightSkillName = buildSkillData('right')?.skillName || '未选择技能';

  statusEl.textContent = `当前对决: [左] ${leftName} - ${leftSkillName} VS [右] ${rightName} - ${rightSkillName}`;

  // Highlight selected cards
  document.querySelectorAll('unit-card').forEach(c => c.classList.remove('selected'));
  if (selectedUnitLeft) {
    const card = document.querySelector(`unit-card[data-unit-id="${selectedUnitLeft.getUnitId()}"]`);
    if (card) card.classList.add('selected');

    const container = document.getElementById('editor-container-left');
    if (container && !container.contains(selectedUnitLeft)) {
      container.innerHTML = '';
      container.appendChild(selectedUnitLeft);
    }
  }
  if (selectedUnitRight) {
    const card = document.querySelector(`unit-card[data-unit-id="${selectedUnitRight.getUnitId()}"]`);
    if (card) card.classList.add('selected');

    const container = document.getElementById('editor-container-right');
    if (container && !container.contains(selectedUnitRight)) {
      container.innerHTML = '';
      container.appendChild(selectedUnitRight);
    }
  }
}

function addUnit(camp: 'left' | 'right', config?: Partial<UnitConfig>) {
  const list = document.getElementById(`unit-list-${camp}`);
  if (!list) return;

  const unit = document.createElement('unit-input') as UnitInputElement;
  const id = `${camp === 'left' ? 'L' : 'R'}${Math.floor(Math.random() * 10000)}`;

  customElements.whenDefined('unit-input').then(() => {
    unit.setUnitId(id);
    if (config) {
      const defaultActiveSkillId = config.activeSkillId ?? config.skills?.[0]?.skillId;
      unit.setValues({
        ...config,
        skills: config.skills ?? [],
        activeSkillId: defaultActiveSkillId,
      });
    } else {
      unit.setValues({ name: `单位 ${id}`, skills: [], activeSkillId: undefined });
    }

    // Create card
    const card = document.createElement('unit-card') as any;
    card.setAttribute('data-unit-id', id);
    card.setData(unit.getData());
    list.appendChild(card);

    card.addEventListener('click', () => {
      if (camp === 'left') {
        persistActiveSkill('left');
        selectedUnitLeft = unit;
        selectedSkillIdLeft = null;
      } else {
        persistActiveSkill('right');
        selectedUnitRight = unit;
        selectedSkillIdRight = null;
      }
      updateSelectionUI();
    });

    unit.addEventListener('remove-unit', () => {
      if (selectedUnitLeft === unit) {
        selectedUnitLeft = null;
        selectedSkillIdLeft = null;
        activeSkillEditorLeft = null;
        document.getElementById('editor-container-left')!.innerHTML = '';
        document.getElementById('skill-editor-container-left')!.innerHTML = '';
      }
      if (selectedUnitRight === unit) {
        selectedUnitRight = null;
        selectedSkillIdRight = null;
        activeSkillEditorRight = null;
        document.getElementById('editor-container-right')!.innerHTML = '';
        document.getElementById('skill-editor-container-right')!.innerHTML = '';
      }
      card.remove();
      updateSelectionUI();
    });

    // Auto select if it's the first unit
    if (camp === 'left' && !selectedUnitLeft) {
      selectedUnitLeft = unit;
      updateSelectionUI();
    } else if (camp === 'right' && !selectedUnitRight) {
      selectedUnitRight = unit;
      updateSelectionUI();
    }
  });
}

function addSkill(camp: 'left' | 'right', config?: Partial<SkillData>) {
  const unit = getSelectedUnitByCamp(camp);
  if (!unit) {
    log(`请先在${camp === 'left' ? '左' : '右'}侧选择单位，再添加技能`);
    return;
  }

  persistActiveSkill(camp);

  const unitData = unit.getData();
  const skillId = config?.skillId ?? `${camp === 'left' ? 'LS' : 'RS'}${Math.floor(Math.random() * 10000)}`;
  const newSkill: SkillData = {
    skillId,
    skillName: config?.skillName ?? `技能 ${skillId}`,
    tags: config?.tags ?? ['active'],
    dice: config?.dice ?? [{ tags: ['slash'], min: 1, max: 6, effects: [] }],
    skillEffects: config?.skillEffects ?? [],
  };

  unit.setValues({ skills: [...(unitData.skills ?? []), newSkill], activeSkillId: newSkill.skillId });
  updateUnitCard(unit);
  setSelectedSkillIdByCamp(camp, newSkill.skillId);
  renderSkillsPanel(camp);
  updateSelectionUI();
}

// Global exports
window.log = log;
window.getVal = getVal;
window.setVal = setVal;
window.getUnitElement = getUnitElement;
window.buildStatusConfig = buildStatusConfig;
window.buildSkillData = buildSkillData;
window.buildDiceConfig = buildDiceConfig;
window.buildSkillEffectConfig = buildSkillEffectConfig;
window.consumeStatus = consumeStatus;
window.dealDirectHpDamage = dealDirectHpDamage;
window.endTurn = endTurn;

// Setup event listeners for adding units
document.getElementById('add-unit-left')?.addEventListener('click', () => addUnit('left'));
document.getElementById('add-unit-right')?.addEventListener('click', () => addUnit('right'));
document.getElementById('add-skill-left')?.addEventListener('click', () => addSkill('left'));
document.getElementById('add-skill-right')?.addEventListener('click', () => addSkill('right'));

// Initial units
addUnit('left', {
  name: '左侧先锋',
  hp: 250,
  maxHp: 250,
  sanity: 45,
  maxSanity: 45,
  shield: 20,
  status: [{ type: 'bleed', stack: 1, power: 1 }],
  skills: [{
    skillId: 'LS1001',
    skillName: '左侧默认技能',
    tags: ['active'],
    dice: [{ tags: ['slash'], min: 4, max: 8, effects: [] }],
    skillEffects: [],
  }]
});

addUnit('right', {
  name: '右侧卫兵',
  hp: 200,
  maxHp: 200,
  sanity: 45,
  maxSanity: 45,
  shield: 10,
  status: [{ type: 'protection', stack: 1, power: 1 }],
  skills: [{
    skillId: 'RS1001',
    skillName: '右侧默认技能',
    tags: ['active'],
    dice: [{ tags: ['slash'], min: 3, max: 9, effects: [] }],
    skillEffects: [],
  }]
});



// ✅ 在文件最底部，使用 use() 链式注册插件
window.combatEngine
  .use(CoinEffectsPlugin)
  .use(SkillEffectsPlugin)
  .use(StatusModifiersPlugin);

console.log('✅ 游戏引擎初始化完成，阵营模式已就绪！');
