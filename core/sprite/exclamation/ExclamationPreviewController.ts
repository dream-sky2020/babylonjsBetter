import { createExclamationMarkSprite, type ExclamationMarkSpriteController } from './createExclamationMarkSprite';
import type { ExclamationMarkPreset } from './exclamationMark.types';
import { TransformNode,type Scene } from '@babylonjs/core';
import type { SpriteVisualSurfaceFactory } from '../render/spriteVisualSurface';
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
export class ExclamationPreviewController {
    private readonly exclamationPreviews = new Map<string, ExclamationVisualEntry>();
    private disposed = false;
    private readonly scene: Scene;
    private readonly spriteSurfaceFactory;
    private readonly root: TransformNode;
    constructor(scene: Scene, options: { spriteSurfaceFactory?: SpriteVisualSurfaceFactory } = {}) {
        this.scene = scene;
        this.spriteSurfaceFactory = options.spriteSurfaceFactory;
        this.root = new TransformNode('ExclamationPreviewController', scene);
    }
    syncExclamationPreview(previewId: string, preset: ExclamationMarkPreset, debugVisible = false): void {
        if (this.disposed)
            return;
        const markProgressStructure = withoutProgress(preset.progress);
        const baseProgressStructure = withoutProgress(preset.base.progress);
        const structureSignature = JSON.stringify({
            ...preset,
            progress: markProgressStructure,
            base: { ...preset.base, progress: baseProgressStructure }
        });
        const existing = this.exclamationPreviews.get(previewId);
        if (existing?.structureSignature === structureSignature) {
            existing.controller.setFillPercent((preset.progress.progress ?? 1));
            existing.controller.setBaseProgress(preset.base.progress);
            existing.controller.setDebugVisible(debugVisible);
            return;
        }
        existing?.controller.dispose();
        const controller = createExclamationMarkSprite(this.scene, preset, (preset.progress.progress ?? 1), this.spriteSurfaceFactory);
        controller.mesh.parent = this.root;
        controller.setBaseProgress(preset.base.progress);
        controller.setDebugVisible(debugVisible);
        this.exclamationPreviews.set(previewId, { controller, structureSignature });
    }
    setExclamationPreviewProgress(previewId: string, exclamationProgress: number, baseProgress: number, basePreset?: ExclamationMarkPreset['base']): boolean {
        const entry = this.exclamationPreviews.get(previewId);
        if (!entry)
            return false;
        entry.controller.setFillPercent(exclamationProgress);
        entry.controller.setBaseProgress({
            ...(basePreset?.progress ?? entry.controller.preset.base.progress),
            progress: baseProgress
        });
        return true;
    }
    clearExclamationPreview(previewId: string): void {
        this.exclamationPreviews.get(previewId)?.controller.dispose();
        this.exclamationPreviews.delete(previewId);
    }
    clearAllExclamationPreviews(): void {
        for (const previewId of [...this.exclamationPreviews.keys()])
            this.clearExclamationPreview(previewId);
    }
    clear(): void { this.clearAllExclamationPreviews(); }
    dispose(): void { this.disposed = true; this.clear(); this.root.dispose(); }
    update(_dt: number): void { }
}
