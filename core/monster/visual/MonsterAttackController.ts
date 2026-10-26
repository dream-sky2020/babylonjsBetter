import { getMonsterAttackDefinition,type MonsterAttackPreset } from '@/core/monster-attack-motion';
import { Vector3 } from '@babylonjs/core';
import type { MonsterActionCoordinator } from './MonsterActionCoordinator';
import type { MonsterVisualRenderer } from './MonsterVisualRenderer';
type Attack = {
    elapsed: number;
    duration: number;
    direction: Vector3;
    preset: MonsterAttackPreset;
    definition: NonNullable<ReturnType<typeof getMonsterAttackDefinition>>;
    onComplete?: () => void;
};
export class MonsterAttackController {
    private readonly renderer: MonsterVisualRenderer;
    private readonly coordinator: MonsterActionCoordinator;
    static readonly key = 'attack';
    private disposed = false;
    private readonly attacks = new Map<string, Attack>();
    private readonly offRemove;
    private readonly offCoordinator;
    constructor(renderer: MonsterVisualRenderer, coordinator: MonsterActionCoordinator) {
        this.renderer = renderer;
        this.coordinator = coordinator;
        this.offRemove = renderer.onRemove(id => this.stopMonsterAttack(id));
        this.offCoordinator = coordinator.register('attack', id => this.stopMonsterAttack(id));
    }
    has(id: string): boolean { return this.attacks.has(id); }
    playMonsterAttack(id: string, preset: MonsterAttackPreset, direction: Vector3, onComplete?: () => void): boolean {
        if (this.disposed) return false;
        const definition = getMonsterAttackDefinition(preset.modeId);
        if (!this.renderer.has(id) || !definition)
            return false;
        const normalized = direction.clone();
        normalized.y = 0;
        if (normalized.lengthSquared() < .000001)
            normalized.set(0, 0, 1);
        else
            normalized.normalize();
        this.coordinator.beforePlay('attack', id);
        this.stopMonsterAttack(id);
        this.attacks.set(id, { elapsed: 0, duration: Math.max(.05, Number(preset.parameters.duration) || 1), direction: normalized,
            preset: { ...preset, parameters: { ...preset.parameters } }, definition, onComplete });
        return true;
    }
    stopMonsterAttack(id: string): void { this.attacks.delete(id); this.renderer.setEffect(id, 'attack', null); }
    stopAllAttacks(): void { for (const id of this.attacks.keys())
        this.stopMonsterAttack(id); }
    update(dt: number): void {
        for (const [id, active] of this.attacks) {
            active.elapsed += dt;
            const progress = Math.min(1, active.elapsed / active.duration);
            this.renderer.setEffect(id, 'attack', active.definition.sample({ progress, direction: active.direction }, active.preset.parameters));
            if (progress < 1)
                continue;
            this.stopMonsterAttack(id);
            active.onComplete?.();
        }
    }
    clear(): void { this.stopAllAttacks(); }
    dispose(): void { if (this.disposed) return; this.disposed = true; this.clear(); this.offRemove(); this.offCoordinator(); }
}
