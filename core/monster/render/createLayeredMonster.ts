import { Color3, TransformNode, Vector3, type Scene } from '@babylonjs/core';
import { createAtlasSpritePlane } from '@/core/sprite/render/createAtlasSpritePlane.ts';
import type { SpriteDissolveEffectState } from '@/core/sprite/dissolve/spriteDissolve.types.ts';
import type { StripeLayerProgressOptions, StripeProgressMaskOptions } from '@/core/sprite/render/spriteVisualEffect.types.ts';
import { MONSTER_RENDER_ORDER, STRIPE_NONE } from '@/core/monster/config/monsterConfig.ts';
import { toMonsterResourceUrl } from '@/core/monster/resource/monsterResources.ts';
import type { MonsterDisplayConfig, MonsterFacingAxis, MonsterLayerKey, MonsterStripePreset, StripePresetLibrary } from '@/core/monster/types/monster.types.ts';
import type { IconPlaneController } from '@/core/sprite/types/sprite.types.ts';
import type { SpriteVisualSurfaceFactory } from '@/core/sprite/render/spriteVisualSurface.ts';
import { DEFAULT_PROFILED_SPRITE_VISUAL_SURFACE_FACTORY } from '@/core/sprite/render/createProfiledSpriteVisualSurface.ts';

type LayerHandle = { sprite: IconPlaneController };

export type LayeredMonsterController = {
  root: TransformNode;
  load: (config: MonsterDisplayConfig, monsterStripePreset: MonsterStripePreset | null, stripePresets: StripePresetLibrary) => void;
  setStripePreset: (monsterStripePreset: MonsterStripePreset | null, stripePresets: StripePresetLibrary) => void;
  setFacingAxis: (axis: MonsterFacingAxis) => void;
  setTransform: (scale: number, height?: number, offsetX?: number) => void;
  setEffectOffset: (offsetX: number, offsetY?: number) => void;
  setLayerEffectOffset: (key: MonsterLayerKey, offsetX: number, offsetY?: number) => void;
  clearLayerEffectOffsets: () => void;
  setColorOverlay: (color: Color3, alpha: number) => void;
  setLayerProgress: (
    key: MonsterLayerKey,
    progress: StripeProgressMaskOptions,
    layerProgress: StripeLayerProgressOptions
  ) => void;
  setDissolve: (options: SpriteDissolveEffectState) => void;
  /** @deprecated 兼容旧 Lab；新代码使用 setDissolve。 */
  setNoiseErode: (options: SpriteDissolveEffectState) => void;
  updateTime: (timeSec: number) => void;
  getLayerMesh: (key: MonsterLayerKey) => IconPlaneController['mesh'] | null;
  dispose: () => void;
};

export type CreateLayeredMonsterOptions = { surfaceFactory?: SpriteVisualSurfaceFactory };

export const createLayeredMonster = (
  scene: Scene,
  name = 'layeredMonster',
  options: CreateLayeredMonsterOptions = {}
): LayeredMonsterController => {
  const root = new TransformNode(`${name}_root`, scene);
  const layers = new Map<MonsterLayerKey, LayerHandle>();
  let facingAxis: MonsterFacingAxis = '+Z';
  const basePosition = new Vector3(0, 0, 0);

  const disposeLayers = () => {
    for (const handle of layers.values()) {
      handle.sprite.dispose?.();
    }
    layers.clear();
  };

  const applyFacing = (handle: LayerHandle) => {
    handle.sprite.mesh.rotation.x = 0;
    handle.sprite.mesh.rotation.z = 0;
    handle.sprite.mesh.rotation.y = facingAxis === '+Z' ? Math.PI : 0;
  };

  const load = (config: MonsterDisplayConfig, monsterStripePreset: MonsterStripePreset | null, stripePresets: StripePresetLibrary) => {
    disposeLayers();
    facingAxis = config.spriteFacingAxis;
    MONSTER_RENDER_ORDER.forEach((layerKey, index) => {
      const textureUrl = toMonsterResourceUrl(config.layers[layerKey].path);
      if (!textureUrl) return;
      const layerStyle = monsterStripePreset?.layers[layerKey];
      const stripeKey = layerStyle?.stripePresetKey || STRIPE_NONE;
      const stripePreset = stripePresets[stripeKey];
      const sprite = createAtlasSpritePlane(scene, textureUrl, 2.8, {
        shareTexture: false,
        subdivisions: 12,
        surfaceRole: 'monster-layer',
        surfaceName: `${name}_${layerKey}_surface`,
        surfaceFactory: options.surfaceFactory ?? DEFAULT_PROFILED_SPRITE_VISUAL_SURFACE_FACTORY,
        initialEffects: {
          stripe: stripeKey === STRIPE_NONE || !stripePreset ? { mode: 'texture' } : stripePreset
        }
      });
      sprite.mesh.name = `${name}_${layerKey}`;
      sprite.mesh.parent = root;
      sprite.mesh.position = new Vector3(0, 0, index * 0.01);
      sprite.mesh.isPickable = false;
      const handle: LayerHandle = { sprite };
      applyFacing(handle);

      sprite.mesh.setEnabled(layerStyle?.visible !== false);
      layers.set(layerKey, handle);
    });
    const scale = Math.max(0.01, config.scaleSize / 560) * Math.max(0.01, config.scene3dScale);
    root.scaling.setAll(scale);
    basePosition.set(config.scene3dOffsetX, config.scene3dHeight, root.position.z);
    root.position.copyFrom(basePosition);
  };

  return {
    root,
    load,
    setStripePreset: (monsterStripePreset, stripePresets) => {
      for (const [layerKey, handle] of layers) {
        const layerStyle = monsterStripePreset?.layers[layerKey];
        handle.sprite.mesh.setEnabled(layerStyle?.visible !== false);
        const stripeKey = layerStyle?.stripePresetKey || STRIPE_NONE;
        const stripePreset = stripePresets[stripeKey];
        handle.sprite.surface.setEffects({
          stripe: stripeKey === STRIPE_NONE || !stripePreset ? { mode: 'texture' } : stripePreset
        });
      }
    },
    setFacingAxis: (axis) => {
      facingAxis = axis;
      for (const handle of layers.values()) applyFacing(handle);
    },
    setTransform: (scale, height = root.position.y, offsetX = root.position.x) => {
      root.scaling.setAll(Math.max(0.01, scale));
      basePosition.x = offsetX;
      basePosition.y = height;
      root.position.copyFrom(basePosition);
    },
    setEffectOffset: (offsetX, offsetY = 0) => {
      root.position.x = basePosition.x + offsetX;
      root.position.y = basePosition.y + offsetY;
    },
    setLayerEffectOffset: (key, offsetX, offsetY = 0) => {
      const handle = layers.get(key);
      if (!handle) return;
      handle.sprite.mesh.position.x = offsetX;
      handle.sprite.mesh.position.y = offsetY;
    },
    clearLayerEffectOffsets: () => {
      for (const handle of layers.values()) {
        handle.sprite.mesh.position.x = 0;
        handle.sprite.mesh.position.y = 0;
      }
    },
    setColorOverlay: (color, alpha) => {
      const normalizedAlpha = Math.max(0, Math.min(1, Number.isFinite(alpha) ? alpha : 0));
      for (const handle of layers.values()) {
        handle.sprite.surface.setEffects({ colorOverlay: { color, alpha: normalizedAlpha } });
        handle.sprite.mesh.renderOverlay = false;
      }
    },
    setLayerProgress: (key, progress, layerProgress) => {
      layers.get(key)?.sprite.surface.setEffects({
        progressMask: progress,
        layerProgressMask: layerProgress
      });
    },
    setDissolve: (options) => {
      for (const handle of layers.values()) {
        if (Number.isFinite(options.vertexSubdivisions)) handle.sprite.setSubdivisions(options.vertexSubdivisions!);
        handle.sprite.surface.setEffects({ dissolve: options });
      }
    },
    setNoiseErode: (options) => {
      for (const handle of layers.values()) {
        if (Number.isFinite(options.vertexSubdivisions)) handle.sprite.setSubdivisions(options.vertexSubdivisions!);
        handle.sprite.surface.setEffects({ dissolve: options });
      }
    },
    updateTime: (timeSec) => {
      for (const handle of layers.values()) handle.sprite.surface.setTime(timeSec);
    },
    getLayerMesh: (key) => layers.get(key)?.sprite.mesh || null,
    dispose: () => {
      disposeLayers();
      root.dispose();
    }
  };
};
