import type { VisualBattlefield,VisualMonster } from './monsterVisual.types';
export type MonsterDistanceStripeRule = {
    id: string;
    /** 从第几行开始生效，使用从 1 开始的行号。 */
    startRow: number;
    monsterStripePresetKey: string;
};
export type BattlefieldDistanceStripeRuleConfig = {
    battlefieldId: string;
    name: string;
    rules: MonsterDistanceStripeRule[];
};
export type BattlefieldDistanceStripeRuleLibrary = Record<string, BattlefieldDistanceStripeRuleConfig>;
export const normalizeDistanceStripeRuleConfig = (battlefieldId: string, value?: Partial<BattlefieldDistanceStripeRuleConfig>): BattlefieldDistanceStripeRuleConfig => ({
    battlefieldId,
    name: typeof value?.name === 'string' && value.name.trim() ? value.name : `${battlefieldId} 条纹距离规则`,
    rules: Array.isArray(value?.rules)
        ? value.rules.map((rule, index) => ({
            id: typeof rule.id === 'string' && rule.id.trim() ? rule.id : `rule_${index + 1}`,
            startRow: Math.max(1, Math.round(Number(rule.startRow) || index + 1)),
            monsterStripePresetKey: typeof rule.monsterStripePresetKey === 'string' ? rule.monsterStripePresetKey : ''
        })).sort((a, b) => a.startRow - b.startRow)
        : []
});
export const resolveDistanceStripePresetKey = (rules: readonly MonsterDistanceStripeRule[], row: number, fallback: string): string => {
    const rowNumber = row + 1;
    let match = fallback;
    for (const rule of [...rules].sort((a, b) => a.startRow - b.startRow)) {
        if (rowNumber >= rule.startRow && rule.monsterStripePresetKey)
            match = rule.monsterStripePresetKey;
    }
    return match;
};
export const calculateMonsterWorldPosition = (battlefield: VisualBattlefield, monster: VisualMonster) => ({
    x: monster.position.isOccupyingFullRowCentered
        ? 0
        : (monster.position.column + monster.position.size / 2 - battlefield.width / 2) * battlefield.cellSize,
    z: -monster.position.row * battlefield.rowSpacing
});
export class MonsterDistanceStripeRules {
    static readonly key = 'distanceStripes';
    private readonly distanceStripeRules = new Map<string, BattlefieldDistanceStripeRuleConfig>();
    setDistanceStripeRules(config: BattlefieldDistanceStripeRuleConfig): void {
        this.distanceStripeRules.set(config.battlefieldId, normalizeDistanceStripeRuleConfig(config.battlefieldId, config));
    }
    setDistanceStripeRuleLibrary(library: BattlefieldDistanceStripeRuleLibrary): void {
        this.distanceStripeRules.clear();
        Object.entries(library).forEach(([battlefieldId, config]) => {
            this.setDistanceStripeRules({ ...config, battlefieldId });
        });
    }
    getDistanceStripeRules(battlefieldId: string): BattlefieldDistanceStripeRuleConfig | undefined {
        const config = this.distanceStripeRules.get(battlefieldId);
        return config ? normalizeDistanceStripeRuleConfig(battlefieldId, config) : undefined;
    }
    exportDistanceStripeRuleLibrary(): BattlefieldDistanceStripeRuleLibrary {
        return Object.fromEntries([...this.distanceStripeRules].map(([battlefieldId, config]) => [
            battlefieldId,
            normalizeDistanceStripeRuleConfig(battlefieldId, config)
        ]));
    }
    resolveMonsterStripePresetKey(battlefield: VisualBattlefield, monster: VisualMonster, fallback: string): string {
        const rules = this.distanceStripeRules.get(battlefield.id)?.rules ?? [];
        return resolveDistanceStripePresetKey(rules, monster.position.row, fallback);
    }
    getRowCount(id: string): number { return Math.max(1, ...(this.distanceStripeRules.get(id)?.rules ?? []).map(rule => rule.startRow)); }
    clear(): void { this.distanceStripeRules.clear(); }
    dispose(): void { this.clear(); }
}
