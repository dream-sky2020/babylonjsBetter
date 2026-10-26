import type { MonsterActionCoordinator } from './MonsterActionCoordinator';
import type { MonsterHitVisualParameters } from './monsterVisual.types';
import type { MonsterVisualRenderer } from './MonsterVisualRenderer';
const profiles = [{ amplitude: .42, phase: .15, vertical: .1 }, { amplitude: .68, phase: 1.35, vertical: .14 },
    { amplitude: 1, phase: 2.6, vertical: .18 }, { amplitude: 1.28, phase: 4.05, vertical: .22 }];
export class MonsterHitController {
    private readonly renderer: MonsterVisualRenderer;
    private readonly coordinator: MonsterActionCoordinator;
    static readonly key = 'hit';
    private disposed = false;
    private readonly hits = new Map<string, {
        elapsedMs: number;
        parameters: MonsterHitVisualParameters;
        onComplete?: () => void;
    }>();
    private readonly offRemove;
    private readonly offCoordinator;
    constructor(renderer: MonsterVisualRenderer, coordinator: MonsterActionCoordinator) {
        this.renderer = renderer;
        this.coordinator = coordinator;
        this.offRemove = renderer.onRemove(id => this.stopMonsterHit(id));
        this.offCoordinator = coordinator.register('hit', id => this.stopMonsterHit(id));
    }
    playMonsterHit(id: string, parameters: MonsterHitVisualParameters, onComplete?: () => void): boolean {
        if (this.disposed) return false;
        if (!this.renderer.has(id))
            return false;
        this.coordinator.beforePlay('hit', id);
        this.stopMonsterHit(id);
        this.hits.set(id, { elapsedMs: 0, parameters: {
                durationMs: Math.max(1, Number(parameters.durationMs) || 1), shakeAmplitude: Math.max(0, Number(parameters.shakeAmplitude) || 0),
                shakeFrequency: Math.max(0, Number(parameters.shakeFrequency) || 0), overlayStrength: Math.max(0, Math.min(1, Number(parameters.overlayStrength) || 0)), color: parameters.color.clone(),
            }, onComplete });
        return true;
    }
    stopMonsterHit(id: string): void { this.hits.delete(id); this.renderer.setEffect(id, 'hit', null); }
    stopAllHits(): void { for (const id of this.hits.keys())
        this.stopMonsterHit(id); }
    update(dt: number): void {
        for (const [id, active] of this.hits) {
            active.elapsedMs += dt * 1000;
            const p = active.parameters, progress = Math.max(0, Math.min(1, active.elapsedMs / p.durationMs));
            if (progress >= 1) {
                this.stopMonsterHit(id);
                active.onComplete?.();
                continue;
            }
            const envelope = Math.pow(1 - progress, 1.35), phase = progress * p.durationMs / 1000 * p.shakeFrequency * Math.PI * 2;
            const flash = progress < .18 ? 1 : Math.pow(1 - (progress - .18) / .82, 1.6);
            this.renderer.setEffect(id, 'hit', { overlayColor: p.color, overlayStrength: p.overlayStrength * flash,
                layers: profiles.map(profile => ({ offsetX: Math.sin(phase + profile.phase) * p.shakeAmplitude * profile.amplitude * envelope,
                    offsetY: Math.sin((phase + profile.phase) * 1.73 + .8) * p.shakeAmplitude * profile.vertical * envelope })) });
        }
    }
    clear(): void { this.stopAllHits(); }
    dispose(): void { if (this.disposed) return; this.disposed = true; this.clear(); this.offRemove(); this.offCoordinator(); }
}
