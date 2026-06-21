// combat-api.ts
import { STATUS_TYPES } from './config.ts';
import { getUnitElement } from './utils/combat-utils.ts';
import type { UnitId, UnitConfig, StatusConfig, SkillData, SkillEffectConfig, DiceConfig } from './types.ts';
import type { ClashUIManager } from './ui-manager.ts';

// --- 基础工具与日志 ---
export function log(msg: string): void {
    const logElement = document.getElementById('gameLog');
    if (!logElement) return;
    logElement.innerHTML += `<div>> ${msg}</div>`;
    logElement.scrollTop = logElement.scrollHeight;
}

export function getCampByUnitId(unitId: UnitId): 'left' | 'right' {
    return unitId === 'A' || unitId === 'left' ? 'left' : 'right';
}

function getStatusLabel(typeId: string): string {
    const match = STATUS_TYPES.find((status) => status.id === typeId);
    return match ? match.label : typeId;
}

// --- 数据获取与设置 ---
export function getVal(id: string): number {
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

export function setVal(id: string, val: number, uiManager: ClashUIManager): void {
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
        uiManager.updateUnitCard(unit);
    }
}

// --- 状态与伤害结算 ---
export function consumeStatus(unitId: UnitId, typeId: string): { type: string; label: string; power: number; prevStack: number; nextStack: number } | null {
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

export function dealDirectHpDamage(unitId: UnitId, amount: number, reason: string): number {
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

export function endTurn(uiManager: ClashUIManager): void {
    log('=== 回合结束结算 ===');
    if (uiManager.getSelectedUnit('left')) {
        const burn = consumeStatus('left', 'burn');
        if (burn) dealDirectHpDamage('left', burn.power, '烧伤(回合结束)');
    }
    if (uiManager.getSelectedUnit('right')) {
        const burn = consumeStatus('right', 'burn');
        if (burn) dealDirectHpDamage('right', burn.power, '烧伤(回合结束)');
    }
    log('=== 回合结束结算完毕 ===');
}

// --- 构建配置对象 ---
export function buildStatusConfig(unitId: UnitId): StatusConfig[] {
    const unit = getUnitElement(unitId);
    return unit ? unit.getData().status : [];
}

export function buildSkillData(unitId: UnitId, uiManager: ClashUIManager): SkillData | null {
    const camp = getCampByUnitId(unitId);
    return uiManager.getSelectedSkillData(camp);
}

export function buildSkillEffectConfig(unitId: UnitId, uiManager: ClashUIManager): SkillEffectConfig[] {
    const skill = buildSkillData(unitId, uiManager);
    return skill ? skill.skillEffects : [];
}

export function buildDiceConfig(unitId: UnitId, uiManager: ClashUIManager): DiceConfig[] {
    const skill = buildSkillData(unitId, uiManager);
    return skill?.dice ?? [];
}

// --- 初始数据加载 ---
export function loadInitialData(uiManager: ClashUIManager): void {
    uiManager.addUnit('left', {
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

    uiManager.addUnit('right', {
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
}

// --- 全局对象绑定 ---
export function initCombatApi(uiManager: ClashUIManager) {
    window.log = log;
    window.getVal = getVal;
    window.setVal = (id: string, val: number) => setVal(id, val, uiManager); // 使用闭包注入 uiManager
    window.consumeStatus = consumeStatus;
    window.dealDirectHpDamage = dealDirectHpDamage;
    window.endTurn = () => endTurn(uiManager);

    window.getUnitElement = getUnitElement;
    window.buildStatusConfig = buildStatusConfig;
    window.buildSkillData = (unitId) => buildSkillData(unitId, uiManager);
    window.buildDiceConfig = (unitId) => buildDiceConfig(unitId, uiManager);
    window.buildSkillEffectConfig = (unitId) => buildSkillEffectConfig(unitId, uiManager);
}