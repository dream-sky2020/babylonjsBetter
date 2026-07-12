import { ArcRotateCamera, Engine, Scene, Vector3 } from '@babylonjs/core';

export const DEFAULT_BATTLE_ORTHO_SIZE = 5;
export const MIN_BATTLE_ORTHO_SIZE = 1.5;
export const MAX_BATTLE_ORTHO_SIZE = 14;
export const BATTLE_CAMERA_ZOOM_STEP = 0.1;

export const createBattleCamera = (scene: Scene): ArcRotateCamera => {
  const camera = new ArcRotateCamera('camera', -Math.PI / 2, Math.PI / 2, 10, Vector3.Zero(), scene);
  camera.lowerAlphaLimit = -Math.PI / 2;
  camera.upperAlphaLimit = -Math.PI / 2;
  camera.lowerBetaLimit = Math.PI / 2;
  camera.upperBetaLimit = Math.PI / 2;
  camera.mode = ArcRotateCamera.ORTHOGRAPHIC_CAMERA;
  return camera;
};

export const clampBattleOrthoSize = (value: number): number => {
  return Math.min(MAX_BATTLE_ORTHO_SIZE, Math.max(MIN_BATTLE_ORTHO_SIZE, value));
};

export const applyBattleOrthographicFrustum = (
  camera: ArcRotateCamera,
  engine: Engine,
  orthoSize: number
): void => {
  const width = Math.max(1, engine.getRenderWidth());
  const height = Math.max(1, engine.getRenderHeight());
  const aspectRatio = width / height;
  camera.orthoTop = orthoSize;
  camera.orthoBottom = -orthoSize;
  camera.orthoLeft = -orthoSize * aspectRatio;
  camera.orthoRight = orthoSize * aspectRatio;
};

export const panBattleCameraTargetByPixels = (
  camera: ArcRotateCamera,
  engine: Engine,
  deltaX: number,
  deltaY: number
): void => {
  const worldWidth = (camera.orthoRight ?? 0) - (camera.orthoLeft ?? 0);
  const worldHeight = (camera.orthoTop ?? 0) - (camera.orthoBottom ?? 0);
  const worldPerPixelX = worldWidth / Math.max(1, engine.getRenderWidth());
  const worldPerPixelY = worldHeight / Math.max(1, engine.getRenderHeight());
  camera.target.addInPlace(new Vector3(-deltaX * worldPerPixelX, deltaY * worldPerPixelY, 0));
};
