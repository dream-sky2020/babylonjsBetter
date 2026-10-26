import { createSpecialStatus3d,type SpecialStatus3dConfig,type SpecialStatus3dController } from '@/core/special-status';
import { type Scene } from '@babylonjs/core';
import type { MonsterActionCoordinator } from './MonsterActionCoordinator';
import type { MonsterSpecialStatusVisualItem,MonsterSpecialStatusVisualLayout,MonsterSpecialStatusVisualResources,MonsterVisualOptions } from './monsterVisual.types';
import type { MonsterVisualRenderer } from './MonsterVisualRenderer';
type MonsterSpecialStatusVisualEntry = {
    controller: SpecialStatus3dController;
    configSignature: string;
    stateSignature: string;
};
export class MonsterSpecialStatusAttachments {
    private readonly renderer: MonsterVisualRenderer;
    static readonly key = 'specialStatuses';
    private readonly specialStatuses = new Map<string, Map<string, MonsterSpecialStatusVisualEntry>>();
    private readonly specialStatusGenerations = new Map<string, number>();
    private generation = 0;
    private disposed = false;
    private readonly scene: Scene;
    private readonly spriteSurfaceFactory;
    private readonly offRemove: () => void;
    constructor(renderer: MonsterVisualRenderer, _coordinator: MonsterActionCoordinator, options: MonsterVisualOptions = {}) {
        this.renderer = renderer;
        this.scene = renderer.scene;
        this.spriteSurfaceFactory = options.spriteSurfaceFactory;
        this.offRemove = renderer.onRemove(id => this.clearMonsterSpecialStatuses(id));
    }
    async syncMonsterSpecialStatuses(monsterId: string, items: readonly MonsterSpecialStatusVisualItem[], resources: MonsterSpecialStatusVisualResources, layout: MonsterSpecialStatusVisualLayout): Promise<void> {
        if (this.disposed)
            return;
        const monster = this.renderer.getAttachmentRoot(monsterId);
        if (!monster) {
            this.clearMonsterSpecialStatuses(monsterId);
            return;
        }
        const generation = ++this.generation;
        this.specialStatusGenerations.set(monsterId, generation);
        const entries = this.specialStatuses.get(monsterId) ?? new Map<string, MonsterSpecialStatusVisualEntry>();
        this.specialStatuses.set(monsterId, entries);
        const nextIds = new Set(items.map((item) => item.id));
        for (const [statusVisualId, entry] of entries) {
            if (nextIds.has(statusVisualId))
                continue;
            entry.controller.dispose();
            entries.delete(statusVisualId);
        }
        const columns = Math.max(1, Math.floor(layout.wrapCount));
        const rowCount = Math.max(1, Math.ceil(items.length / columns));
        for (const [itemIndex, item] of items.entries()) {
            if (this.specialStatusGenerations.get(monsterId) !== generation)
                return;
            const preset = resources.visualPresets[item.presetKey];
            const statusDefinition = preset?.statuses[item.statusId];
            const numberPreset = preset && resources.numberPresets[preset.babylon3d.numberPresetKey];
            if (!preset || !statusDefinition || !numberPreset) {
                const invalidEntry = entries.get(item.id);
                invalidEntry?.controller.dispose();
                entries.delete(item.id);
                continue;
            }
            const row = Math.floor(itemIndex / columns);
            const column = itemIndex % columns;
            const itemsInRow = Math.min(columns, items.length - row * columns);
            const centeredColumn = column - (itemsInRow - 1) / 2;
            const rowOffset = layout.rowAnchorMode === 'first-row-up'
                ? row
                : layout.rowAnchorMode === 'first-row-down'
                    ? -row
                    : row - (rowCount - 1) / 2;
            const visual = preset.babylon3d;
            const position: [
                number,
                number,
                number
            ] = [
                visual.position[0] + layout.groupOffset[0] + layout.spacing[0] * centeredColumn,
                visual.position[1] + layout.groupOffset[1] + layout.spacing[1] * rowOffset,
                visual.position[2] + layout.groupOffset[2] + layout.spacing[2] * rowOffset
            ];
            const config: SpecialStatus3dConfig = {
                iconPath: statusDefinition.imagePath || '/resources/favicon.svg',
                numberPreset,
                statusHeight: visual.statusHeight,
                statusScale: visual.statusScale,
                numberScale: visual.numberScale,
                cornerInset: visual.cornerInset,
                position,
                numberOffsets: visual.numberOffsets.map((offset) => [...offset]) as SpecialStatus3dConfig['numberOffsets'],
                billboard: layout.billboard,
                facingAxis: layout.facingAxis
            };
            const configSignature = JSON.stringify([config, layout.groupScale, layout.debugVisible]);
            const stateSignature = JSON.stringify([item.values, item.visible]);
            let entry = entries.get(item.id);
            if (!entry) {
                const controller = await createSpecialStatus3d(this.scene, config, {
                    values: item.values,
                    visible: item.visible,
                    debug: layout.debugVisible
                }, `monsterStatus_${monsterId}_${item.id}`, this.spriteSurfaceFactory);
                if (this.specialStatusGenerations.get(monsterId) !== generation || !this.renderer.has(monsterId)) {
                    controller.dispose();
                    return;
                }
                controller.root.parent = monster;
                controller.root.scaling.setAll(Math.max(0.01, layout.groupScale));
                entry = { controller, configSignature, stateSignature };
                entries.set(item.id, entry);
                continue;
            }
            if (entry.configSignature !== configSignature) {
                await entry.controller.setConfig(config);
                if (this.specialStatusGenerations.get(monsterId) !== generation)
                    return;
                entry.controller.root.scaling.setAll(Math.max(0.01, layout.groupScale));
                entry.controller.setDebugVisible(layout.debugVisible);
                entry.configSignature = configSignature;
            }
            if (entry.stateSignature !== stateSignature) {
                await entry.controller.setValues(item.values, item.visible);
                if (this.specialStatusGenerations.get(monsterId) !== generation)
                    return;
                entry.stateSignature = stateSignature;
            }
        }
    }
    clearMonsterSpecialStatuses(monsterId: string): void {
        this.specialStatusGenerations.set(monsterId, ++this.generation);
        const entries = this.specialStatuses.get(monsterId);
        entries?.forEach(({ controller }) => controller.dispose());
        this.specialStatuses.delete(monsterId);
    }
    clearAllMonsterSpecialStatuses(): void {
        for (const monsterId of [...this.specialStatuses.keys()])
            this.clearMonsterSpecialStatuses(monsterId);
        this.specialStatusGenerations.clear();
    }
    clear(): void { this.clearAllMonsterSpecialStatuses(); }
    dispose(): void { this.disposed = true; this.clear(); this.offRemove(); }
}
