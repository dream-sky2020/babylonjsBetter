// combat-api.ts
import { STATUS_TYPES } from './config.ts';
import { useCombatStore } from './store.ts';
import type { UnitId, UnitConfig, StatusConfig, SkillData, SkillEffectConfig, DiceConfig } from './types.ts';

// --- 基础工具与日志 ---
export function log(msg: string): void {
    useCombatStore.getState().addLog(msg);
}

export function getCampByUnitId(unitId: UnitId): 'left' | 'right' {
    const state = useCombatStore.getState();
    if (unitId === 'A' || unitId === 'left' || state.leftUnits.some(u => u.id === unitId)) return 'left';
    return 'right';
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
        const unit = useCombatStore.getState().getUnit(unitId);
        if (!unit) return 0;
        const fieldMap: Record<string, keyof UnitConfig> = {
            hp: 'hp',
            maxHp: 'maxHp',
            shd: 'shield',
            tempShd: 'tempShield',
            san: 'sanity',
            maxSan: 'maxSanity',
            chaos: 'chaos',
            chaosThreshold: 'chaosThreshold',
            speed: 'speed',
            baseSpeed: 'baseSpeed',
            speedModifier: 'speedModifier'
        };
        return Number(unit[fieldMap[field]]) || 0;
    }
    return 0;
}

export function setVal(id: string, val: number): void {
    const match = id.match(/^(hp|maxHp|shd|tempShd|san|maxSan|chaos|chaosThreshold)(.*)$/);
    if (match) {
        const [_, field, unitId] = match;
        const state = useCombatStore.getState();
        const unit = state.getUnit(unitId);
        if (!unit) return;
        
        const side = getCampByUnitId(unit.id);
        const fieldMap: Record<string, keyof UnitConfig> = {
            hp: 'hp',
            maxHp: 'maxHp',
            shd: 'shield',
            tempShd: 'tempShield',
            san: 'sanity',
            maxSan: 'maxSanity',
            chaos: 'chaos',
            chaosThreshold: 'chaosThreshold',
            speed: 'speed',
            baseSpeed: 'baseSpeed',
            speedModifier: 'speedModifier'
        };
        const targetField = fieldMap[field];
        const patch: Partial<UnitConfig> = { [targetField]: val } as Partial<UnitConfig>;

        if (targetField === 'maxHp') {
            const nextMaxHp = Math.max(1, Number(val) || 1);
            patch.maxHp = nextMaxHp;
            if (unit.hp > nextMaxHp) {
                patch.hp = nextMaxHp;
            }
        } else if (targetField === 'maxSanity') {
            const nextMaxSanity = Math.max(0, Number(val) || 0);
            patch.maxSanity = nextMaxSanity;
            if (unit.sanity > nextMaxSanity) {
                patch.sanity = nextMaxSanity;
            }
        } else if (targetField === 'hp') {
            const maxHp = Math.max(1, Number(unit.maxHp) || 1);
            patch.hp = Math.max(0, Math.min(Number(val) || 0, maxHp));
        } else if (targetField === 'sanity') {
            const maxSanity = Math.max(0, Number(unit.maxSanity) || 0);
            patch.sanity = Math.max(0, Math.min(Number(val) || 0, maxSanity));
        }

        state.updateUnit(side, unit.id, patch);
    }
}

// --- 状态与伤害结算 ---
export function consumeStatus(unitId: UnitId, typeId: string): { type: string; label: string; power: number; prevStack: number; nextStack: number } | null {
    const state = useCombatStore.getState();
    const unit = state.getUnit(unitId);
    if (!unit) return null;

    const statusList = [...unit.status];
    const index = statusList.findIndex(s => s.type === typeId && s.stack > 0);

    if (index === -1) return null;

    const status = { ...statusList[index] };
    const prevStack = status.stack;
    const nextStack = Math.max(0, prevStack - 1);

    status.stack = nextStack;
    statusList[index] = status;
    
    const side = getCampByUnitId(unit.id);
    state.updateUnit(side, unit.id, { status: statusList });

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

    const state = useCombatStore.getState();
    const unit = state.getUnit(unitId);
    if (!unit) return 0;

    const oldHp = unit.hp;
    const newHp = Math.max(0, oldHp - damage);
    const actual = oldHp - newHp;

    const side = getCampByUnitId(unit.id);
    state.updateUnit(side, unit.id, { hp: newHp });
    log(`${unit.name || unitId} 触发${reason}，受到 ${actual} 点状态伤害 (HP: ${oldHp} → ${newHp})`);

    if (newHp <= 0) {
        log(`💀 ${unit.name || unitId} 已阵亡！`);
    }
    return actual;
}

export function endTurn(): void {
    log('=== 回合结束结算 ===');
    const state = useCombatStore.getState();
    if (state.selectedLeftUnitId) {
        const burn = consumeStatus('left', 'burn');
        if (burn) dealDirectHpDamage('left', burn.power, '烧伤(回合结束)');
    }
    if (state.selectedRightUnitId) {
        const burn = consumeStatus('right', 'burn');
        if (burn) dealDirectHpDamage('right', burn.power, '烧伤(回合结束)');
    }
    log('=== 回合结束结算完毕 ===');
}

// --- 构建配置对象 ---
export function buildStatusConfig(unitId: UnitId): StatusConfig[] {
    const unit = useCombatStore.getState().getUnit(unitId);
    return unit ? unit.status : [];
}

export function buildSkillData(unitId: UnitId): SkillData | null {
    const state = useCombatStore.getState();
    const unit = state.getUnit(unitId);
    if (!unit || !unit.activeSkillId) return null;
    return unit.skills.find(s => s.skillId === unit.activeSkillId) || null;
}

export function buildSkillEffectConfig(unitId: UnitId): SkillEffectConfig[] {
    const skill = buildSkillData(unitId);
    return skill ? skill.skillEffects : [];
}

export function buildDiceConfig(unitId: UnitId): DiceConfig[] {
    const skill = buildSkillData(unitId);
    return skill?.dice ?? [];
}

// --- 初始数据加载 ---
export function loadInitialData(): void {
    const state = useCombatStore.getState();
    state.addUnit('left', {
        id: 'A1',
        name: '左侧先锋',
        hp: 250,
        maxHp: 250,
        sanity: 45,
        maxSanity: 45,
        shield: 20,
        tempShield: 0,
        chaos: 0,
        chaosThreshold: 100,
        speed: 10,
        baseSpeed: 10,
        speedModifier: 0,
        status: [{ type: 'bleed', stack: 1, power: 1 }],
        skills: [{
            skillId: 'LS1001',
            skillName: '左侧默认技能',
            tags: ['active'],
            dice: [{ tags: ['slash'], min: 4, max: 8, effects: [] }],
            skillEffects: [],
        }],
        activeSkillId: 'LS1001'
    });
    state.selectUnit('left', 'A1');

    state.addUnit('right', {
        id: 'B1',
        name: '右侧卫兵',
        hp: 200,
        maxHp: 200,
        sanity: 45,
        maxSanity: 45,
        shield: 10,
        tempShield: 0,
        chaos: 0,
        chaosThreshold: 100,        
        speed: 10,
        baseSpeed: 10,
        speedModifier: 0,
        status: [{ type: 'protection', stack: 1, power: 1 }],
        skills: [{
            skillId: 'RS1001',
            skillName: '右侧默认技能',
            tags: ['active'],
            dice: [{ tags: ['slash'], min: 3, max: 9, effects: [] }],
            skillEffects: [],
        }],
        activeSkillId: 'RS1001'
    });
    state.selectUnit('right', 'B1');
}

// --- 全局对象绑定 ---
export function initCombatApi() {
    window.log = log;
    window.getVal = getVal;
    window.setVal = setVal;
    window.consumeStatus = consumeStatus;
    window.dealDirectHpDamage = dealDirectHpDamage;
    window.endTurn = endTurn;

    window.buildStatusConfig = buildStatusConfig;
    window.buildSkillData = buildSkillData;
    window.buildDiceConfig = buildDiceConfig;
    window.buildSkillEffectConfig = buildSkillEffectConfig;
}
