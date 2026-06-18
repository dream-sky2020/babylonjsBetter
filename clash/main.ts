import { STATUS_TYPES } from './dice-effect-config.ts';
import './dice-input.ts';
import './skill-effect-input.ts';
import './clash-logic-engine.ts';
import { registerAllCombatEffects } from './clash-logic-effects.ts';
import './clash-logic-startClash.ts';
import type { SkillEffectConfig, StatusConfig, UnitId } from './types.ts';

function getInputElement(id: string): HTMLInputElement {
  const element = document.getElementById(id);
  if (!(element instanceof HTMLInputElement)) {
    throw new Error(`Missing input element: ${id}`);
  }
  return element;
}

function log(msg: string): void {
  const logElement = document.getElementById('gameLog');
  if (!logElement) return;
  logElement.innerHTML += `<div>> ${msg}</div>`;
  logElement.scrollTop = logElement.scrollHeight;
}

function getVal(id: string): number {
  return Number.parseInt(getInputElement(id).value, 10) || 0;
}

function setVal(id: string, val: number): void {
  getInputElement(id).value = String(val);
}

function createDieInput(data: Record<string, unknown> = {}): DiceInputElement {
  const dieElement = document.createElement('dice-input') as DiceInputElement;
  customElements.whenDefined('dice-input').then(() => {
    dieElement.setValues(data);
  });
  return dieElement;
}

function createStatusInput(data: Partial<StatusConfig> = {}): HTMLElement {
  const div = document.createElement('div');
  div.className = 'status-item';

  const statusOptions = STATUS_TYPES.map((status) => `<option value="${status.id}">${status.label}</option>`).join('');
  div.innerHTML = `
    <select class="status-type">${statusOptions}</select>
    <span>层数</span>
    <input type="number" class="status-stack" value="${data.stack ?? 1}" min="0">
    <span>强度</span>
    <input type="number" class="status-power" value="${data.power ?? 1}" min="0">
    <button type="button" class="remove-status">删</button>
  `;

  const selectElement = div.querySelector('.status-type') as HTMLSelectElement | null;
  if (selectElement) {
    if (data.type && STATUS_TYPES.some((status) => status.id === data.type)) {
      selectElement.value = data.type;
    } else if (STATUS_TYPES.length > 0) {
      selectElement.value = STATUS_TYPES[0].id;
    }
  }

  const removeButton = div.querySelector('.remove-status');
  if (removeButton) {
    removeButton.addEventListener('click', () => {
      div.remove();
    });
  }

  return div;
}

function buildStatusConfig(unitId: UnitId): StatusConfig[] {
  const list = document.getElementById(`status-list-${unitId}`);
  if (!list) return [];

  return Array.from(list.querySelectorAll('.status-item')).map((item) => ({
    type: (item.querySelector('.status-type') as HTMLSelectElement | null)?.value ?? '',
    stack: Number.parseInt((item.querySelector('.status-stack') as HTMLInputElement | null)?.value ?? '0', 10) || 0,
    power: Number.parseInt((item.querySelector('.status-power') as HTMLInputElement | null)?.value ?? '0', 10) || 0,
  }));
}

function buildSkillEffectConfig(unitId: UnitId): SkillEffectConfig[] {
  const list = document.getElementById(`skill-effect-list-${unitId}`);
  if (!list) return [];
  return Array.from(list.querySelectorAll('skill-effect-input')).map((element) => (element as SkillEffectInputElement).getData());
}

function getStatusLabel(typeId: string): string {
  const match = STATUS_TYPES.find((status) => status.id === typeId);
  return match ? match.label : typeId;
}

function consumeStatus(unitId: UnitId, typeId: string): { type: string; label: string; power: number; prevStack: number; nextStack: number } | null {
  const list = document.getElementById(`status-list-${unitId}`);
  if (!list) return null;

  const items = Array.from(list.querySelectorAll('.status-item'));
  for (const item of items) {
    const typeElement = item.querySelector('.status-type') as HTMLSelectElement | null;
    const stackElement = item.querySelector('.status-stack') as HTMLInputElement | null;
    const powerElement = item.querySelector('.status-power') as HTMLInputElement | null;
    if (!typeElement || !stackElement || !powerElement) continue;
    if (typeElement.value !== typeId) continue;

    const currentStack = Number.parseInt(stackElement.value, 10) || 0;
    if (currentStack <= 0) continue;

    const power = Number.parseInt(powerElement.value, 10) || 0;
    const nextStack = Math.max(0, currentStack - 1);
    stackElement.value = String(nextStack);
    return {
      type: typeId,
      label: getStatusLabel(typeId),
      power,
      prevStack: currentStack,
      nextStack,
    };
  }
  return null;
}

function dealDirectHpDamage(unitId: UnitId, amount: number, reason: string): number {
  const damage = Math.max(0, Number.parseInt(String(amount), 10) || 0);
  if (damage <= 0) return 0;

  const oldHp = getVal('hp' + unitId);
  const newHp = Math.max(0, oldHp - damage);
  const actual = oldHp - newHp;
  setVal('hp' + unitId, newHp);
  log(`${unitId} 触发${reason}，受到 ${actual} 点状态伤害 (HP: ${oldHp} → ${newHp})`);
  if (newHp <= 0) {
    log(`💀 ${unitId} 已阵亡！`);
  }
  return actual;
}

function setupDicePanel(unitId: UnitId, defaults: Array<Record<string, unknown>>): void {
  const list = document.getElementById(`dice-list-${unitId}`);
  const addButton = document.getElementById(`add-die-btn-${unitId}`);
  if (!list || !addButton) return;

  defaults.forEach((data) => list.appendChild(createDieInput(data)));
  addButton.addEventListener('click', () => {
    list.appendChild(createDieInput({ tags: [], min: 0, max: 0, effect: '' }));
  });
}

function setupStatusPanel(unitId: UnitId, defaults: StatusConfig[]): void {
  const list = document.getElementById(`status-list-${unitId}`);
  const addButton = document.getElementById(`add-status-btn-${unitId}`);
  if (!list || !addButton) return;

  defaults.forEach((status) => list.appendChild(createStatusInput(status)));
  addButton.addEventListener('click', () => {
    list.appendChild(createStatusInput({}));
  });
}

function setupSkillEffectPanel(unitId: UnitId, defaults: SkillEffectConfig[] = []): void {
  const container = document.getElementById(`skill-effect-list-${unitId}`);
  const addButton = document.getElementById(`add-skill-effect-${unitId}`);
  if (!container || !addButton) return;

  container.innerHTML = '';

  defaults.forEach((effectData) => {
    const effectElement = document.createElement('skill-effect-input') as SkillEffectInputElement;
    container.appendChild(effectElement);
    customElements.whenDefined('skill-effect-input').then(() => {
      effectElement.setValues(effectData);
    });
  });

  addButton.addEventListener('click', () => {
    const effectElement = document.createElement('skill-effect-input');
    const rowWrapper = document.createElement('div');
    rowWrapper.className = 'effect-row-wrapper';
    rowWrapper.style.display = 'flex';
    rowWrapper.style.alignItems = 'center';
    rowWrapper.style.gap = '5px';
    rowWrapper.appendChild(effectElement);
    container.appendChild(rowWrapper);
  });
}

function endTurn(): void {
  log('=== 回合结束结算 ===');
  (['A', 'B'] as UnitId[]).forEach((unitId) => {
    const burn = consumeStatus(unitId, 'burn');
    if (burn) {
      dealDirectHpDamage(unitId, burn.power, '烧伤(回合结束)');
    }
  });
  log('=== 回合结束结算完毕 ===');
}

window.log = log;
window.getVal = getVal;
window.setVal = setVal;
window.buildStatusConfig = buildStatusConfig;
window.buildSkillEffectConfig = buildSkillEffectConfig;
window.consumeStatus = consumeStatus;
window.dealDirectHpDamage = dealDirectHpDamage;
window.createStatusInput = createStatusInput;
window.endTurn = endTurn;

setupDicePanel('A', [{ tags: ['slash'], min: 4, max: 8, effect: '' }]);
setupDicePanel('B', [{ tags: ['slash'], min: 3, max: 10, effect: '' }]);

setupStatusPanel('A', [{ type: 'bleed', stack: 1, power: 1 }]);
setupStatusPanel('B', [{ type: 'protection', stack: 1, power: 1 }]);

setupSkillEffectPanel('A', [{ timing: 'onHit', type: 'applyStatus', statusId: 'bleed', power: 1, stack: 2 }]);
setupSkillEffectPanel('B', [{ timing: 'onAfterHit', type: 'heal', value: 10 }]);

registerAllCombatEffects(window.combatEngine);
