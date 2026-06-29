import { useCallback, useEffect, useRef } from 'react';
import type { SpriteAnchorPreset } from '@app-types/sprite-anchors.types';
import { createMockSprite, drawSpriteDebugHelper } from '../../utils/mockSprite';
import type { MockSprite } from '../../utils/mockSprite';
import type { Scene } from '@babylonjs/core';
import type { MutableRefObject } from 'react';
import type { SpriteFrameRegion } from '../../utils/meshFactory';

type AtlasFrameRegion = SpriteFrameRegion & { atlasPath: string; atlasImagePath: string };

interface UseSpritePreviewParams {
  sceneRef: MutableRefObject<Scene | null>;
  spriteRef: MutableRefObject<MockSprite | null>;
  preset: SpriteAnchorPreset;
  presetRef: MutableRefObject<SpriteAnchorPreset>;
  imagePath: string;
  activeImagePath: string;
  currentFrameRegion: AtlasFrameRegion | null;
}

interface UseSpritePreviewResult {
  disposeDebugMeshes: () => void;
  redrawDebugHelper: (nextPreset: SpriteAnchorPreset) => void;
}

export const useSpritePreview = ({
  sceneRef,
  spriteRef,
  preset,
  presetRef,
  imagePath,
  activeImagePath,
  currentFrameRegion
}: UseSpritePreviewParams): UseSpritePreviewResult => {
  const debugMeshesRef = useRef<ReturnType<typeof drawSpriteDebugHelper>>([]);

  const disposeDebugMeshes = useCallback(() => {
    debugMeshesRef.current.forEach((mesh) => mesh.dispose());
    debugMeshesRef.current = [];
  }, []);

  const redrawDebugHelper = useCallback((nextPreset: SpriteAnchorPreset) => {
    const scene = sceneRef.current;
    const sprite = spriteRef.current;
    if (!scene || !sprite) return;
    disposeDebugMeshes();
    const debugMockSprite: MockSprite = { ...sprite, preset: nextPreset };
    debugMeshesRef.current = drawSpriteDebugHelper(debugMockSprite, scene);
  }, [disposeDebugMeshes, sceneRef]);

  useEffect(() => {
    presetRef.current = preset;
    redrawDebugHelper(preset);
  }, [preset, presetRef, redrawDebugHelper]);

  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    disposeDebugMeshes();
    spriteRef.current?.mesh.dispose(false, true);
    const texturePath = encodeURI(`/${activeImagePath || imagePath}`);
    spriteRef.current = createMockSprite(scene, texturePath, 4.8, 'merged');
    spriteRef.current?.setFrameRegion(currentFrameRegion);
    redrawDebugHelper(presetRef.current);
  }, [activeImagePath, currentFrameRegion, disposeDebugMeshes, imagePath, presetRef, redrawDebugHelper, sceneRef]);

  useEffect(() => {
    spriteRef.current?.setFrameRegion(currentFrameRegion);
  }, [currentFrameRegion]);

  useEffect(() => {
    return () => {
      disposeDebugMeshes();
      spriteRef.current?.mesh.dispose(false, true);
      spriteRef.current = null;
    };
  }, [disposeDebugMeshes]);

  return {
    disposeDebugMeshes,
    redrawDebugHelper
  };
};
