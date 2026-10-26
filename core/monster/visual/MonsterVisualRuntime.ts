import { Vector3,type Scene } from '@babylonjs/core';
import { MonsterActionCoordinator } from './MonsterActionCoordinator';
import type { MonsterAttackController } from './MonsterAttackController';
import type { MonsterDeathController } from './MonsterDeathController';
import type { MonsterDistanceStripeRules } from './MonsterDistanceStripeRules';
import { calculateMonsterWorldPosition,type BattlefieldDistanceStripeRuleConfig } from './MonsterDistanceStripeRules';
import type { MonsterExclamationAttachments } from './MonsterExclamationAttachments';
import type { MonsterHitController } from './MonsterHitController';
import type { MonsterLayoutHelpers } from './MonsterLayoutHelpers';
import type { MonsterMovementController } from './MonsterMovementController';
import type { MonsterSpecialStatusAttachments } from './MonsterSpecialStatusAttachments';
import type { MonsterVisualCapability,MonsterVisualOptions,MonsterVisualResources,VisualBattlefield } from './monsterVisual.types';
import { MonsterVisualRenderer } from './MonsterVisualRenderer';
type Capabilities = {
    movement: MonsterMovementController;
    attack: MonsterAttackController;
    hit: MonsterHitController;
    death: MonsterDeathController;
    layout: MonsterLayoutHelpers;
    distanceStripes: MonsterDistanceStripeRules;
    specialStatuses: MonsterSpecialStatusAttachments;
    exclamations: MonsterExclamationAttachments;
};
export type MonsterVisualCapabilityFactory = {
    readonly key: keyof Capabilities;
    new (renderer: MonsterVisualRenderer, coordinator: MonsterActionCoordinator, options: MonsterVisualOptions): MonsterVisualCapability;
};
/** Explicit assembly and frame order only. Capabilities own their state; renderer owns sprite mutation. */
export class MonsterVisualRuntime {
    readonly renderer: MonsterVisualRenderer;
    private readonly installed = new Map<keyof Capabilities, MonsterVisualCapability>();
    private readonly coordinator = new MonsterActionCoordinator();
    private readonly options: MonsterVisualOptions;
    private disposed = false;
    constructor(scene: Scene, options: MonsterVisualOptions & {
        capabilities?: readonly MonsterVisualCapabilityFactory[];
    } = {}) {
        this.renderer = new MonsterVisualRenderer(scene, options);
        this.options = options;
        try {
            for (const Capability of options.capabilities ?? []) {
                this.installCapability(Capability);
            }
        }
        catch (error) {
            this.dispose();
            throw error;
        }
    }
    private require<K extends keyof Capabilities>(key: K): Capabilities[K] {
        const capability = this.installed.get(key);
        if (!capability)
            throw new Error(`Monster capability is not installed: ${key}`);
        return capability as Capabilities[K];
    }
    get movement() { return this.require('movement'); }
    get attack() { return this.require('attack'); }
    get hit() { return this.require('hit'); }
    get death() { return this.require('death'); }
    get layout() { return this.require('layout'); }
    get distanceStripes() { return this.require('distanceStripes'); }
    get specialStatuses() { return this.require('specialStatuses'); }
    get exclamations() { return this.require('exclamations'); }
    installCapability(Capability: MonsterVisualCapabilityFactory): () => void {
        if (this.disposed) throw new Error('Monster runtime has been disposed');
        if (this.installed.has(Capability.key)) throw new Error(`Duplicate monster capability: ${Capability.key}`);
        const instance = new Capability(this.renderer, this.coordinator, this.options);
        this.installed.set(Capability.key, instance);
        return () => {
            if (this.installed.get(Capability.key) === instance) this.removeCapability(Capability.key);
        };
    }
    removeCapability(key: keyof Capabilities): void {
        this.installed.get(key)?.dispose();
        this.installed.delete(key);
    }
    sync(battlefield: VisualBattlefield, resources: MonsterVisualResources, selectedId = '', rules?: BattlefieldDistanceStripeRuleConfig): void {
        const distance = this.installed.get('distanceStripes') as MonsterDistanceStripeRules | undefined;
        if (rules) {
            if (!distance)
                throw new Error('Distance stripe rules capability is not installed');
            distance.setDistanceStripeRules(rules);
        }
        const inputs = battlefield.monsters.flatMap(monster => {
            const config = resources.configs[monster.monsterConfigKey];
            if (!config)
                return [];
            const fallback = monster.monsterStripePresetKey || config.monsterStripePresetKey;
            const stripeKey = distance?.resolveMonsterStripePresetKey(battlefield, monster, fallback) ?? fallback;
            const position = calculateMonsterWorldPosition(battlefield, monster);
            return [{ id: monster.id, config, stripeKey, stripe: resources.monsterStripes[stripeKey] ?? null, stripes: resources.stripes,
                    position: new Vector3(position.x, 0, position.z) }];
        });
        const movement = this.installed.get('movement') as MonsterMovementController | undefined;
        const attack = this.installed.get('attack') as MonsterAttackController | undefined;
        this.renderer.sync(inputs, id => !!movement?.has(id) || !!attack?.has(id));
        const layout = this.installed.get('layout') as MonsterLayoutHelpers | undefined;
        layout?.sync(battlefield, selectedId, Math.max(1, ...battlefield.monsters.map(monster => monster.position.row + 1), distance?.getRowCount(battlefield.id) ?? 1));
    }
    update(dt: number): void {
        this.renderer.update(dt);
        for (const key of ['movement', 'attack', 'hit', 'death', 'layout'] as const)
            this.installed.get(key)?.update?.(dt);
    }
    clear(): void {
        for (const [key, capability] of this.installed) {
            if (key !== 'distanceStripes') capability.clear();
        }
        this.renderer.clear();
    }
    dispose(): void {
        if (this.disposed)
            return;
        this.disposed = true;
        for (const capability of [...this.installed.values()].reverse())
            capability.dispose();
        this.installed.clear();
        this.renderer.dispose();
    }
}
