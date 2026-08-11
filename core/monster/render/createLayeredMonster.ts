import { Color3, TransformNode, Vector3, type Material, type Scene } from '@babylonjs/core';
import { createAtlasSpritePlane } from '@/core/sprite/render/createAtlasSpritePlane.ts';
import { createSpriteMaskMaterial, type StripeMaskMaterialController } from '@/core/sprite/render/createSpriteEffectMaterial.ts';
import { MONSTER_RENDER_ORDER, STRIPE_NONE } from '@/core/monster/config/monsterConfig.ts';
import { toMonsterResourceUrl } from '@/core/monster/resource/monsterResources.ts';
import type { MonsterDisplayConfig, MonsterFacingAxis, MonsterLayerKey, MonsterStripePreset, StripePresetLibrary } from '@/core/monster/types/monster.types.ts';
import type { IconPlaneController } from '@/core/sprite/types/sprite.types.ts';

type LayerHandle = { sprite: IconPlaneController; baseMaterial: Material | null; stripe: StripeMaskMaterialController | null };

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
  updateTime: (timeSec: number) => void;
  getLayerMesh: (key: MonsterLayerKey) => IconPlaneController['mesh'] | null;
  dispose: () => void;
};

export const createLayeredMonster = (scene: Scene, name = 'layeredMonster'): LayeredMonsterController => {
  const root = new TransformNode(`${name}_root`, scene);
  const layers = new Map<MonsterLayerKey, LayerHandle>();
  let facingAxis: MonsterFacingAxis = '+Z';
  const basePosition = new Vector3(0, 0, 0);

  const disposeLayers = () => {
    for (const handle of layers.values()) {
      handle.stripe?.dispose();
      handle.sprite.dispose();
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
      const sprite = createAtlasSpritePlane(scene, textureUrl, 2.8, { shareTexture: false });
      sprite.mesh.name = `${name}_${layerKey}`;
      sprite.mesh.parent = root;
      sprite.mesh.position = new Vector3(0, 0, index * 0.01);
      sprite.mesh.isPickable = false;
      const handle: LayerHandle = { sprite, baseMaterial: sprite.mesh.material, stripe: null };
      applyFacing(handle);

      const layerStyle = monsterStripePreset?.layers[layerKey];
      sprite.mesh.setEnabled(layerStyle?.visible !== false);
      const stripeKey = layerStyle?.stripePresetKey || STRIPE_NONE;
      const stripePreset = stripePresets[stripeKey];
      {
        const textureSize = sprite.texture.getSize();
        const stripe = createSpriteMaskMaterial(
          scene,
          `${name}_${layerKey}_stripe`,
          textureUrl,
          stripeKey === STRIPE_NONE || !stripePreset ? { mode: 'texture' } : stripePreset,
          {
            width: Math.max(1, textureSize.width),
            height: Math.max(1, textureSize.height)
          }
        );
        sprite.texture.onLoadObservable.addOnce(() => {
          const loadedSize = sprite.texture.getSize();
          stripe.updateRenderSize(
            Math.max(1, loadedSize.width),
            Math.max(1, loadedSize.height)
          );
        });
        sprite.mesh.material = stripe.material;
        handle.stripe = stripe;
      }
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
        handle.stripe?.updatePreset(
          stripeKey === STRIPE_NONE || !stripePreset
            ? { mode: 'texture' }
            : stripePreset
        );
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
        handle.sprite.mesh.overlayColor.copyFrom(color);
        handle.sprite.mesh.overlayAlpha = normalizedAlpha;
        handle.sprite.mesh.renderOverlay = normalizedAlpha > 0.001;
      }
    },
    updateTime: (timeSec) => {
      for (const handle of layers.values()) handle.stripe?.updateTime(timeSec);
    },
    getLayerMesh: (key) => layers.get(key)?.sprite.mesh || null,
    dispose: () => {
      disposeLayers();
      root.dispose();
    }
  };
};
