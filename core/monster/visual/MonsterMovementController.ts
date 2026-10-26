import { getMonsterMotionDefinition,type MonsterMotionPreset } from '@/core/monster-motion';
import { Vector3 } from '@babylonjs/core';
import type { MonsterActionCoordinator } from './MonsterActionCoordinator';
import { calculateMonsterWorldPosition } from './MonsterDistanceStripeRules';
import type { VisualBattlefield,VisualMonster } from './monsterVisual.types';
import type { MonsterVisualRenderer } from './MonsterVisualRenderer';
type Motion = {
    from: Vector3;
    to: Vector3;
    elapsed: number;
    duration: number;
    preset: MonsterMotionPreset;
    definition: NonNullable<ReturnType<typeof getMonsterMotionDefinition>>;
    onComplete?: () => void;
};
export class MonsterMovementController {
    private readonly renderer: MonsterVisualRenderer;
    private readonly coordinator: MonsterActionCoordinator;
    static readonly key = 'movement';
    private disposed = false;
    private readonly motions = new Map<string, Motion>();
    private readonly offRemove;
    private readonly offCoordinator;
    constructor(renderer: MonsterVisualRenderer, coordinator: MonsterActionCoordinator) {
        this.renderer = renderer;
        this.coordinator = coordinator;
        this.offRemove = renderer.onRemove(id => this.stopMonsterMovement(id));
        this.offCoordinator = coordinator.register('movement', id => this.stopMonsterMovement(id));
    }
    has(id: string): boolean { return this.motions.has(id); }
    moveMonster(battlefield: VisualBattlefield, monster: VisualMonster, preset: MonsterMotionPreset, onComplete?: () => void): boolean {
        if (this.disposed) return false;
        const from = this.renderer.getMonsterWorldPosition(monster.id), definition = getMonsterMotionDefinition(preset.modeId);
        if (!from || !definition)
            return false;
        this.coordinator.beforePlay('movement', monster.id);
        this.stopMonsterMovement(monster.id);
        const target = calculateMonsterWorldPosition(battlefield, monster);
        this.motions.set(monster.id, { from, to: new Vector3(target.x, 0, target.z), elapsed: 0,
            duration: Math.max(.05, Number(preset.parameters.duration) || 1), preset: { ...preset, parameters: { ...preset.parameters } }, definition, onComplete });
        return true;
    }
    stopMonsterMovement(id: string): void { this.motions.delete(id); this.renderer.setEffect(id, 'movement', null); }
    stopAllMovements(): void { for (const id of this.motions.keys())
        this.stopMonsterMovement(id); }
    update(dt: number): void {
        for (const [id, active] of this.motions) {
            active.elapsed += dt;
            const progress = Math.min(1, active.elapsed / active.duration);
            const direction = active.to.subtract(active.from);
            direction.y = 0;
            const distance = direction.length();
            if (distance > 0)
                direction.scaleInPlace(1 / distance);
            const frame = active.definition.sample({ progress, from: active.from, to: active.to, direction, distance }, active.preset.parameters);
            this.renderer.setEffect(id, 'movement', frame);
            if (progress < 1)
                continue;
            this.renderer.setEffect(id, 'movement', { anchorPosition: active.to });
            this.stopMonsterMovement(id);
            active.onComplete?.();
        }
    }
    clear(): void { this.stopAllMovements(); }
    dispose(): void { if (this.disposed) return; this.disposed = true; this.clear(); this.offRemove(); this.offCoordinator(); }
}
