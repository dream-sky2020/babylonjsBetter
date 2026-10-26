import { createExclamationMarkSprite,type ExclamationMarkPreset,type ExclamationMarkSpriteController } from '@/core/sprite';
import { type Scene } from '@babylonjs/core';
import type { MonsterExclamationPositionConfig } from '../exclamation/monsterExclamationPosition.types';
import type { MonsterActionCoordinator } from './MonsterActionCoordinator';
import type { MonsterExclamationVisualResources,MonsterVisualOptions } from './monsterVisual.types';
import type { MonsterVisualRenderer } from './MonsterVisualRenderer';
type ExclamationVisualEntry = {
    controller: ExclamationMarkSpriteController;
    structureSignature: string;
};
const withoutProgress = <T extends {
    progress?: unknown;
}>(value: T): Omit<T, 'progress'> => {
    const copy = { ...value };
    delete copy.progress;
    return copy;
};
export class MonsterExclamationAttachments {
    private readonly renderer: MonsterVisualRenderer;
    static readonly key = 'exclamations';
    private readonly monsterExclamations = new Map<string, Map<string, ExclamationVisualEntry>>();
    private disposed = false;
    private readonly scene: Scene;
    private readonly spriteSurfaceFactory;
    private readonly offRemove: () => void;
    constructor(renderer: MonsterVisualRenderer, _coordinator: MonsterActionCoordinator, options: MonsterVisualOptions = {}) {
        this.renderer = renderer;
        this.scene = renderer.scene;
        this.spriteSurfaceFactory = options.spriteSurfaceFactory;
        this.offRemove = renderer.onRemove(id => this.clearMonsterExclamations(id));
    }
    syncMonsterExclamations(monsterId: string, config: MonsterExclamationPositionConfig, resources: MonsterExclamationVisualResources, debugVisible = false): void {
        if (this.disposed)
            return;
        const monster = this.renderer.getAttachmentRoot(monsterId);
        if (!monster) {
            this.clearMonsterExclamations(monsterId);
            return;
        }
        const entries = this.monsterExclamations.get(monsterId) ?? new Map<string, ExclamationVisualEntry>();
        this.monsterExclamations.set(monsterId, entries);
        const fallbackMarkKey = Object.keys(resources.markPresets)[0] ?? '';
        const fallbackBaseKey = Object.keys(resources.basePresets)[0] ?? '';
        const visible = config.indicators
            .filter((item) => item.visible && (resources.markPresets[item.exclamationPresetKey] || resources.markPresets[fallbackMarkKey]))
            .sort((a, b) => a.order - b.order);
        const nextIds = new Set(visible.map((item) => item.id));
        for (const [indicatorId, entry] of entries) {
            if (nextIds.has(indicatorId))
                continue;
            entry.controller.dispose();
            entries.delete(indicatorId);
        }
        visible.forEach((item, index) => {
            const mark = resources.markPresets[item.exclamationPresetKey] ?? resources.markPresets[fallbackMarkKey];
            if (!mark)
                return;
            const base = resources.basePresets[item.basePresetKey] ?? resources.basePresets[fallbackBaseKey] ?? mark.base;
            const runtimePreset: ExclamationMarkPreset = {
                ...mark,
                progress: { ...mark.progress, progress: item.exclamationProgress },
                base: { ...base, progress: { ...base.progress, progress: item.baseProgress } }
            };
            const centeredX = (index - (visible.length - 1) / 2) * config.spacing * config.groupScale;
            const localPosition: [
                number,
                number,
                number
            ] = [
                config.groupOffset[0] + centeredX + item.offset[0],
                config.groupOffset[1] + item.offset[1],
                config.groupOffset[2] + item.offset[2]
            ];
            const markProgressStructure = withoutProgress(runtimePreset.progress);
            const baseProgressStructure = withoutProgress(runtimePreset.base.progress);
            const structureSignature = JSON.stringify([{
                    ...runtimePreset,
                    progress: markProgressStructure,
                    base: { ...runtimePreset.base, progress: baseProgressStructure }
                }, localPosition, item.scale, item.baseScale, config.groupScale]);
            const existing = entries.get(item.id);
            if (existing?.structureSignature === structureSignature) {
                existing.controller.setFillPercent(item.exclamationProgress);
                existing.controller.setBaseProgress(runtimePreset.base.progress);
                existing.controller.setDebugVisible(debugVisible);
                return;
            }
            existing?.controller.dispose();
            const controller = createExclamationMarkSprite(this.scene, runtimePreset, item.exclamationProgress, this.spriteSurfaceFactory);
            controller.mesh.parent = monster;
            controller.mesh.position.set(...localPosition);
            controller.setScale(item.scale * config.groupScale);
            controller.setBaseScale(item.baseScale * config.groupScale);
            controller.setBaseProgress(runtimePreset.base.progress);
            controller.setDebugVisible(debugVisible);
            entries.set(item.id, { controller, structureSignature });
        });
    }
    clearMonsterExclamations(monsterId: string): void {
        const entries = this.monsterExclamations.get(monsterId);
        entries?.forEach(({ controller }) => controller.dispose());
        this.monsterExclamations.delete(monsterId);
    }
    clearAllMonsterExclamations(): void {
        for (const monsterId of [...this.monsterExclamations.keys()])
            this.clearMonsterExclamations(monsterId);
    }
    setMonsterExclamationProgress(monsterId: string, indicatorId: string, exclamationProgress: number, baseProgress: number, basePreset?: ExclamationMarkPreset['base']): boolean {
        const entry = this.monsterExclamations.get(monsterId)?.get(indicatorId);
        if (!entry)
            return false;
        entry.controller.setFillPercent(exclamationProgress);
        entry.controller.setBaseProgress({
            ...(basePreset?.progress ?? entry.controller.preset.base.progress),
            progress: baseProgress
        });
        return true;
    }
    clear(): void { this.clearAllMonsterExclamations(); }
    dispose(): void { this.disposed = true; this.clear(); this.offRemove(); }
}
