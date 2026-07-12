import type { Scene } from '@babylonjs/core';
import {
  createMockSprite as createCoreMockSprite,
  drawSpriteDebugHelper,
  getBodyAxisAlignedAnchorUv,
  type MockSprite,
  type SpritePresetSource,
  type SpritePresetProvider,
  type SpriteFrameRegion,
  uvToNormalizedAnchor
} from '../shared/core/scene/mockSprite';
import { getSpriteAnchorPreset, toSpritePresetKey } from './spritePresetStorage';

const spritePresetProvider: SpritePresetProvider = {
  toSpritePresetKey,
  getSpriteAnchorPreset
};

export { drawSpriteDebugHelper, getBodyAxisAlignedAnchorUv, uvToNormalizedAnchor };
export type { MockSprite, SpriteFrameRegion, SpritePresetSource };

export const createMockSprite = (
  scene: Scene,
  texturePath: string,
  baseSize: number = 2.5,
  presetSource: SpritePresetSource = 'merged',
  frameRegion: SpriteFrameRegion | null = null
): MockSprite => {
  return createCoreMockSprite(
    scene,
    texturePath,
    baseSize,
    presetSource,
    frameRegion,
    spritePresetProvider
  );
};
