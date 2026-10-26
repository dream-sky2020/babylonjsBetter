import { createSpriteDeathVisualRuntime } from '@/core/effects/sprite-death/createSpriteDeathVisualRuntime';
import type { SpriteDeathVisualRuntime } from '@/core/effects/sprite-death/spriteDeathVisual.types';
import { getMonsterDeathDefinition,type MonsterDeathPreset } from '@/core/monster-death-motion';
import { Color3 } from '@babylonjs/core';
import type { MonsterActionCoordinator } from './MonsterActionCoordinator';
import type { MonsterVisualRenderer } from './MonsterVisualRenderer';
type Death = {
    elapsed: number;
    duration: number;
    preset: MonsterDeathPreset;
    definition: NonNullable<ReturnType<typeof getMonsterDeathDefinition>>;
    visualRuntime?: SpriteDeathVisualRuntime;
    completed: boolean;
    onComplete?: () => void;
};
export class MonsterDeathController {
    private readonly renderer: MonsterVisualRenderer;
    private readonly coordinator: MonsterActionCoordinator;
    static readonly key = 'death';
    private disposed = false;
    private readonly deaths = new Map<string, Death>();
    private readonly offRemove;
    private readonly offCoordinator;
    constructor(renderer: MonsterVisualRenderer, coordinator: MonsterActionCoordinator) {
        this.renderer = renderer;
        this.coordinator = coordinator;
        this.offRemove = renderer.onRemove(id => this.stopMonsterDeath(id));
        this.offCoordinator = coordinator.register('death', id => this.stopMonsterDeath(id));
    }
    playMonsterDeath(id: string, preset: MonsterDeathPreset, onComplete?: () => void): boolean {
        if (this.disposed) return false;
        const definition = getMonsterDeathDefinition(preset.modeId);
        if (!this.renderer.has(id) || !definition)
            return false;
        this.coordinator.beforePlay('death', id);
        this.stopMonsterDeath(id);
        const duration = Math.max(.05, Number(preset.parameters.duration) || 1);
        this.deaths.set(id, { elapsed: 0, duration, preset: { ...preset, parameters: { ...preset.parameters } }, definition, completed: false, onComplete,
            visualRuntime: definition.visual ? createSpriteDeathVisualRuntime({ scene: this.renderer.scene, host: this.renderer.getSurfaceEffects(id)!,
                emitterMesh: this.renderer.getMonsterLayerMesh(id, 'body') ?? this.renderer.getMonsterLayerMesh(id, 'bottomFillMask'),
                visual: definition.visual, parameters: { ...preset.parameters }, duration }) : undefined });
        return true;
    }
    stopMonsterDeath(id: string): void { this.deaths.get(id)?.visualRuntime?.dispose(); this.deaths.delete(id); this.renderer.setEffect(id, 'death', null); }
    stopAllDeaths(): void { for (const id of this.deaths.keys())
        this.stopMonsterDeath(id); }
    update(dt: number): void {
        for (const [id, active] of this.deaths) {
            active.elapsed += dt;
            const progress = Math.max(0, Math.min(1, active.elapsed / active.duration));
            active.visualRuntime?.setProgress(progress);
            active.visualRuntime?.update(active.elapsed);
            const frame = active.definition.sample({ progress }, active.preset.parameters);
            this.renderer.setEffect(id, 'death', { ...frame,
                overlayColor: /^#[0-9a-f]{6}$/i.test(frame.overlayColor) ? Color3.FromHexString(frame.overlayColor) : Color3.White(),
                overlayStrength: Math.max(0, Math.min(1, frame.overlayStrength)) });
            if (progress < 1 || active.completed)
                continue;
            active.completed = true;
            active.onComplete?.();
        }
    }
    clear(): void { this.stopAllDeaths(); }
    dispose(): void { if (this.disposed) return; this.disposed = true; this.clear(); this.offRemove(); this.offCoordinator(); }
}
