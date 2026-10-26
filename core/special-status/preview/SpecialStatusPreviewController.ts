import { createSpecialStatus3d } from '../render/createSpecialStatus3d';
import type { SpecialStatus3dConfig, SpecialStatus3dController, SpecialStatus3dValues, SpecialStatus3dVisibility } from '../types/specialStatus3d.types';
import { TransformNode,type Scene } from '@babylonjs/core';
import type { SpriteVisualSurfaceFactory } from '@/core/sprite/render/spriteVisualSurface';
type MonsterSpecialStatusVisualEntry = {
    controller: SpecialStatus3dController;
    configSignature: string;
    stateSignature: string;
};
type SpecialStatusPreviewEntry = MonsterSpecialStatusVisualEntry & {
    generation: number;
};
export class SpecialStatusPreviewController {
    private readonly specialStatusPreviews = new Map<string, SpecialStatusPreviewEntry>();
    private readonly specialStatusPreviewGenerations = new Map<string, number>();
    private generation = 0;
    private disposed = false;
    private readonly scene: Scene;
    private readonly spriteSurfaceFactory;
    private readonly root: TransformNode;
    constructor(scene: Scene, options: { spriteSurfaceFactory?: SpriteVisualSurfaceFactory } = {}) {
        this.scene = scene;
        this.spriteSurfaceFactory = options.spriteSurfaceFactory;
        this.root = new TransformNode('SpecialStatusPreviewController', scene);
    }
    async syncSpecialStatusPreview(previewId: string, config: SpecialStatus3dConfig, values: SpecialStatus3dValues, visible: SpecialStatus3dVisibility, debugVisible: boolean): Promise<void> {
        if (this.disposed)
            return;
        const generation = ++this.generation;
        this.specialStatusPreviewGenerations.set(previewId, generation);
        const configSignature = JSON.stringify([config, debugVisible]);
        const stateSignature = JSON.stringify([values, visible]);
        let entry = this.specialStatusPreviews.get(previewId);
        if (!entry) {
            const controller = await createSpecialStatus3d(this.scene, config, {
                values,
                visible,
                debug: debugVisible
            }, `specialStatusPreview_${previewId}`, this.spriteSurfaceFactory);
            if (this.specialStatusPreviewGenerations.get(previewId) !== generation) {
                controller.dispose();
                return;
            }
            controller.root.parent = this.root;
            entry = { controller, configSignature, stateSignature, generation };
            this.specialStatusPreviews.set(previewId, entry);
            return;
        }
        entry.generation = generation;
        if (entry.configSignature !== configSignature) {
            await entry.controller.setConfig(config);
            if (this.specialStatusPreviewGenerations.get(previewId) !== generation)
                return;
            entry.controller.setDebugVisible(debugVisible);
            entry.configSignature = configSignature;
        }
        if (entry.stateSignature !== stateSignature) {
            await entry.controller.setValues(values, visible);
            if (this.specialStatusPreviewGenerations.get(previewId) !== generation)
                return;
            entry.stateSignature = stateSignature;
        }
    }
    clearSpecialStatusPreview(previewId: string): void {
        this.specialStatusPreviewGenerations.set(previewId, ++this.generation);
        this.specialStatusPreviews.get(previewId)?.controller.dispose();
        this.specialStatusPreviews.delete(previewId);
    }
    clearAllSpecialStatusPreviews(): void {
        for (const previewId of [...this.specialStatusPreviews.keys()])
            this.clearSpecialStatusPreview(previewId);
        this.specialStatusPreviewGenerations.clear();
    }
    clear(): void { this.clearAllSpecialStatusPreviews(); }
    dispose(): void { this.disposed = true; this.clear(); this.root.dispose(); }
}
