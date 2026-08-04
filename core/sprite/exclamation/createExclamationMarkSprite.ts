import { Mesh, type Scene } from '@babylonjs/core';
import { createAtlasSpritePlane } from '@/core/sprite/render/createAtlasSpritePlane.ts';
import {
  applyExclamationMarkProgressPreset,
  createExclamationMarkProgressMaterial
} from './createExclamationMarkProgressMaterial.ts';
import type { ExclamationMarkPreset } from './exclamationMark.types.ts';

export type ExclamationMarkSpriteController = {
  mesh: ReturnType<typeof createAtlasSpritePlane>['mesh'];
  preset: ExclamationMarkPreset;
  setFillPercent: (percent: number) => void;
  setDebugVisible: (visible: boolean) => void;
  dispose: () => void;
};

export const createExclamationMarkSprite = (
  scene: Scene,
  preset: ExclamationMarkPreset,
  fillPercent = preset.fillPercent
): ExclamationMarkSpriteController => {
  const runtimePreset = { ...preset, fillPercent: Math.max(0, Math.min(1, fillPercent)) };
  const sprite = createAtlasSpritePlane(
    scene,
    encodeURI(`/${preset.imagePath.replace(/^\/+/, '')}`),
    preset.height * preset.scale
  );
  const material = createExclamationMarkProgressMaterial(scene, sprite.texture, runtimePreset);
  sprite.mesh.name = `exclamation_mark_${preset.presetKey}`;
  sprite.mesh.material = material;
  sprite.mesh.position.copyFromFloats(preset.position[0], preset.position[1], preset.position[2]);
  sprite.mesh.billboardMode = preset.faceCamera ? Mesh.BILLBOARDMODE_Y : 0;
  sprite.mesh.isPickable = false;

  return {
    mesh: sprite.mesh,
    preset,
    setFillPercent: (percent) => {
      runtimePreset.fillPercent = Math.max(0, Math.min(1, Number.isFinite(percent) ? percent : 0));
      applyExclamationMarkProgressPreset(material, runtimePreset);
    },
    setDebugVisible: (visible) => { sprite.mesh.showBoundingBox = visible; },
    dispose: () => {
      material.dispose(false, false);
      sprite.dispose();
    }
  };
};
