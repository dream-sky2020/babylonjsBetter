import type { StripeLayerProgressOptions,StripeProgressMaskOptions } from '@/core/sprite/render/spriteVisualEffect.types';
import { Color3,TransformNode,Vector3,type Scene } from '@babylonjs/core';
import { MONSTER_RENDER_ORDER } from '../config/monsterConfig';
import { createLayeredMonster,type LayeredMonsterController } from '../render/createLayeredMonster';
import type { MonsterDisplayConfig,MonsterStripePreset,StripePresetLibrary } from '../types/monster.types';
import type { MonsterVisualChannel,MonsterVisualFrame,MonsterVisualOptions } from './monsterVisual.types';
export type MonsterVisualInput = {
    id: string;
    position: Vector3;
    config: MonsterDisplayConfig;
    stripeKey: string;
    stripe: MonsterStripePreset | null;
    stripes: StripePresetLibrary;
};
type Entry = {
    controller: LayeredMonsterController;
    anchor: TransformNode;
    attachmentRoot: TransformNode;
    basePosition: Vector3;
    baseScaling: Vector3;
    baseRotation: Vector3;
    input: MonsterVisualInput;
    effects: Map<MonsterVisualChannel, MonsterVisualFrame>;
};
const channels: MonsterVisualChannel[] = ['movement', 'attack', 'hit', 'death'];
/** Owns sprites and applies sampled effects. No actions, battlefield rules or helper meshes. */
export class MonsterVisualRenderer {
    readonly scene: Scene;
    private readonly options: MonsterVisualOptions;
    private readonly entries = new Map<string, Entry>();
    private readonly removals = new Set<(id: string) => void>();
    private readonly root: TransformNode;
    private time = 0;
    private disposed = false;
    constructor(scene: Scene, options: MonsterVisualOptions = {}) {
        this.scene = scene;
        this.options = options;
        this.root = new TransformNode('monsterFormationVisuals', scene);
    }
    has(id: string): boolean { return this.entries.has(id); }
    onRemove(listener: (id: string) => void): () => void {
        this.removals.add(listener);
        return () => { this.removals.delete(listener); };
    }
    sync(inputs: readonly MonsterVisualInput[], preservePose: (id: string) => boolean = () => false): void {
        if (this.disposed)
            throw new Error('MonsterVisualRenderer has been disposed');
        const ids = new Set(inputs.map(input => input.id));
        for (const id of this.entries.keys())
            if (!ids.has(id))
                this.remove(id);
        for (const input of inputs) {
            let entry = this.entries.get(input.id);
            if (!entry) {
                const anchor = new TransformNode(`movementAnchor_${input.id}`, this.scene);
                anchor.parent = this.root;
                anchor.position.copyFrom(input.position);
                const controller = createLayeredMonster(this.scene, `placement_${input.id}`, { surfaceFactory: this.options.spriteSurfaceFactory });
                controller.load(input.config, input.stripe, input.stripes);
                controller.root.parent = anchor;
                const attachmentRoot = new TransformNode(`monsterVisualAttachments_${input.id}`, this.scene);
                attachmentRoot.parent = anchor;
                entry = { anchor, controller, attachmentRoot, input, effects: new Map(),
                    basePosition: controller.root.position.clone(), baseScaling: controller.root.scaling.clone(), baseRotation: controller.root.rotation.clone() };
                this.entries.set(input.id, entry);
            }
            else if (entry.input.config !== input.config) {
                // Loading a config must never capture a currently sampled action as the new base transform.
                entry.controller.root.position.copyFrom(entry.basePosition);
                entry.controller.root.rotation.copyFrom(entry.baseRotation);
                entry.controller.root.scaling.copyFrom(entry.baseScaling);
                entry.controller.load(input.config, input.stripe, input.stripes);
                entry.basePosition.copyFrom(entry.controller.root.position);
                entry.baseScaling.copyFrom(entry.controller.root.scaling);
                entry.baseRotation.copyFrom(entry.controller.root.rotation);
            }
            else if (entry.input.stripeKey !== input.stripeKey || entry.input.stripe !== input.stripe || entry.input.stripes !== input.stripes) {
                entry.controller.setStripePreset(input.stripe, input.stripes);
            }
            entry.input = input;
            if (!preservePose(input.id))
                entry.anchor.position.copyFrom(input.position);
            this.apply(entry);
        }
    }
    private remove(id: string): void {
        const entry = this.entries.get(id);
        if (!entry)
            return;
        // Consumers release effects/attachments while the sprite host still exists.
        for (const listener of this.removals)
            listener(id);
        this.entries.delete(id);
        entry.controller.dispose();
        entry.attachmentRoot.dispose();
        entry.anchor.dispose();
    }
    setEffect(id: string, channel: MonsterVisualChannel, frame: MonsterVisualFrame | null): void {
        const entry = this.entries.get(id);
        if (!entry)
            return;
        if (frame)
            entry.effects.set(channel, frame);
        else
            entry.effects.delete(channel);
        this.apply(entry);
    }
    private apply(entry: Entry): void {
        const root = entry.controller.root;
        root.position.copyFrom(entry.basePosition);
        root.rotation.copyFrom(entry.baseRotation);
        root.scaling.copyFrom(entry.baseScaling);
        let overlayColor = Color3.Black(), overlayStrength = 0;
        const layers = MONSTER_RENDER_ORDER.map(() => ({ offsetX: 0, offsetY: 0, opacity: 1 }));
        for (const channel of channels) {
            const frame = entry.effects.get(channel);
            if (!frame)
                continue;
            if (frame.anchorPosition)
                entry.anchor.position.copyFrom(frame.anchorPosition);
            if (frame.visualOffset) {
                root.position.copyFrom(entry.basePosition).addInPlace(frame.visualOffset);
                root.rotation.set(entry.baseRotation.x + (frame.rotationX ?? 0), entry.baseRotation.y + (frame.rotationY ?? 0), entry.baseRotation.z + (frame.rotationZ ?? 0));
                root.scaling.set(entry.baseScaling.x * (frame.scaleX ?? 1), entry.baseScaling.y * (frame.scaleY ?? 1), entry.baseScaling.z * (frame.scaleZ ?? 1));
            }
            if (frame.overlayColor) {
                overlayColor = frame.overlayColor;
                overlayStrength = frame.overlayStrength ?? 0;
            }
            if (frame.layers || frame.opacity !== undefined)
                layers.forEach((layer, i) => {
                    const sample = frame.layers?.[i];
                    layer.offsetX = sample?.offsetX ?? 0;
                    layer.offsetY = sample?.offsetY ?? 0;
                    layer.opacity = Math.max(0, Math.min(1, (frame.opacity ?? 1) * (sample?.opacity ?? 1)));
                });
        }
        entry.controller.setColorOverlay(overlayColor, overlayStrength);
        MONSTER_RENDER_ORDER.forEach((key, i) => {
            const layer = layers[i];
            entry.controller.setLayerEffectOffset(key, layer.offsetX, layer.offsetY);
            const mesh = entry.controller.getLayerMesh(key);
            if (mesh)
                mesh.visibility = layer.opacity;
        });
        entry.attachmentRoot.position.copyFrom(root.position);
        entry.attachmentRoot.rotation.copyFrom(root.rotation);
        entry.attachmentRoot.scaling.setAll(1);
    }
    getAttachmentRoot(id: string): TransformNode | undefined { return this.entries.get(id)?.attachmentRoot; }
    getMonsterWorldPosition(id: string): Vector3 | null {
        const anchor = this.entries.get(id)?.anchor;
        anchor?.computeWorldMatrix(true);
        return anchor?.getAbsolutePosition().clone() ?? null;
    }
    getMonsterVisualWorldPosition(id: string): Vector3 | null {
        const root = this.entries.get(id)?.controller.root;
        root?.computeWorldMatrix(true);
        return root?.getAbsolutePosition().clone() ?? null;
    }
    getMonsterLayerMesh(id: string, key: (typeof MONSTER_RENDER_ORDER)[number]) { return this.entries.get(id)?.controller.getLayerMesh(key) ?? null; }
    setMonsterInstanceOffset(id: string, offset: Vector3): void { this.entries.get(id)?.anchor.position.addInPlace(offset); }
    setMonsterFacingAxis(id: string, axis: '+Z' | '-Z'): void { this.entries.get(id)?.controller.setFacingAxis(axis); }
    setMonsterTransform(id: string, scale: number, height: number, offsetX: number): void {
        const entry = this.entries.get(id);
        if (!entry)
            return;
        entry.controller.root.position.copyFrom(entry.basePosition);
        entry.controller.setTransform(scale, height, offsetX);
        entry.basePosition.copyFrom(entry.controller.root.position);
        entry.baseScaling.copyFrom(entry.controller.root.scaling);
        this.apply(entry);
    }
    setMonsterLayerProgress(id: string, key: (typeof MONSTER_RENDER_ORDER)[number], progress: StripeProgressMaskOptions, layerProgress: StripeLayerProgressOptions): void {
        this.entries.get(id)?.controller.setLayerProgress(key, progress, layerProgress);
    }
    /** Narrow surface-effect port; ownership of sprites stays with the renderer. */
    getSurfaceEffects(id: string) {
        const controller = this.entries.get(id)?.controller;
        return controller ? { setDissolve: controller.setDissolve } : undefined;
    }
    update(dt: number): void { this.time += dt; for (const entry of this.entries.values())
        entry.controller.updateTime(this.time); }
    clear(): void { for (const id of this.entries.keys())
        this.remove(id); }
    dispose(): void { if (this.disposed)
        return; this.clear(); this.disposed = true; this.removals.clear(); this.root.dispose(); }
}
