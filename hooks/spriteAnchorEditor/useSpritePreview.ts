import { useCallback, useEffect, useRef } from 'react';
import {
  createSpriteEntity,
  drawSpriteDebugOverlay,
  type SpriteAnchorPreset,
  type SpriteEntity,
  type SpriteFrameRegion
} from '@/core/sprite';
import type { Scene } from '@babylonjs/core';
import type { MutableRefObject } from 'react';

type AtlasFrameRegion = SpriteFrameRegion & { atlasPath: string; atlasImagePath: string };

interface UseSpritePreviewParams {
  sceneRef: MutableRefObject<Scene | null>;
  spriteRef: MutableRefObject<SpriteEntity | null>;
  preset: SpriteAnchorPreset;
  presetRef: MutableRefObject<SpriteAnchorPreset>;
  imagePath: string;
  activeImagePath: string;
  currentFrameRegion: AtlasFrameRegion | null;
  isDebugVisible: boolean;
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
  currentFrameRegion,
  isDebugVisible
}: UseSpritePreviewParams): UseSpritePreviewResult => {
  const debugMeshesRef = useRef<ReturnType<typeof drawSpriteDebugOverlay>>([]);
  const isDebugVisibleRef = useRef(isDebugVisible);

  const disposeDebugMeshes = useCallback(() => {
    debugMeshesRef.current.forEach((mesh) => mesh.dispose());
    debugMeshesRef.current = [];
  }, []);

  const redrawDebugHelper = useCallback((nextPreset: SpriteAnchorPreset) => {
    const scene = sceneRef.current;
    const sprite = spriteRef.current;
    if (!scene || !sprite) return;
    disposeDebugMeshes();
    if (!isDebugVisibleRef.current) return;
    const debugSpriteEntity: SpriteEntity = { ...sprite, preset: nextPreset };
    debugMeshesRef.current = drawSpriteDebugOverlay(debugSpriteEntity, scene);
  }, [disposeDebugMeshes, sceneRef]);

  useEffect(() => {
    presetRef.current = preset;
    redrawDebugHelper(preset);
  }, [preset, presetRef, redrawDebugHelper]);

  useEffect(() => {
    isDebugVisibleRef.current = isDebugVisible;
    redrawDebugHelper(presetRef.current);
  }, [isDebugVisible, presetRef, redrawDebugHelper]);

  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    disposeDebugMeshes();
    spriteRef.current?.mesh.dispose(false, true);
    const texturePath = encodeURI(`/${activeImagePath || imagePath}`);
    spriteRef.current = createSpriteEntity(scene, texturePath, 4.8, 'merged');
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
