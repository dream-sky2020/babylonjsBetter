import { ArcRotateCamera, Engine, Scene } from '@babylonjs/core';
import {
  applyBattleOrthographicFrustum,
  BATTLE_CAMERA_ZOOM_STEP,
  clampBattleOrthoSize,
  createBattleCamera,
  DEFAULT_BATTLE_ORTHO_SIZE,
  panBattleCameraTargetByPixels
} from '../shared/core/scene/battleCamera.core';

export interface CameraControllerContext {
  camera: ArcRotateCamera;
  updateOrthographicFrustum: () => void;
  dispose: () => void;
}

export const createBattleCameraController = (
  scene: Scene,
  engine: Engine,
  canvas: HTMLCanvasElement
): CameraControllerContext => {
  const camera = createBattleCamera(scene);

  let orthoSize = DEFAULT_BATTLE_ORTHO_SIZE;

  const updateOrthographicFrustum = () => {
    applyBattleOrthographicFrustum(camera, engine, orthoSize);
  };
  updateOrthographicFrustum();

  let isDragging = false;
  let previousX = 0;
  let previousY = 0;

  const handlePointerDown = (event: PointerEvent) => {
    if (event.button !== 0) return;
    isDragging = true;
    previousX = event.clientX;
    previousY = event.clientY;
  };

  const handlePointerMove = (event: PointerEvent) => {
    if (!isDragging) return;

    const deltaX = event.clientX - previousX;
    const deltaY = event.clientY - previousY;
    previousX = event.clientX;
    previousY = event.clientY;

    panBattleCameraTargetByPixels(camera, engine, deltaX, deltaY);
  };

  const handlePointerUp = () => {
    isDragging = false;
  };

  const handleWheel = (event: WheelEvent) => {
    event.preventDefault();
    const direction = Math.sign(event.deltaY);
    if (direction === 0) return;

    const nextOrthoSize = orthoSize * (1 + direction * BATTLE_CAMERA_ZOOM_STEP);
    orthoSize = clampBattleOrthoSize(nextOrthoSize);
    updateOrthographicFrustum();
  };

  canvas.addEventListener('pointerdown', handlePointerDown);
  canvas.addEventListener('pointermove', handlePointerMove);
  window.addEventListener('pointerup', handlePointerUp);
  canvas.addEventListener('wheel', handleWheel, { passive: false });

  const dispose = () => {
    canvas.removeEventListener('pointerdown', handlePointerDown);
    canvas.removeEventListener('pointermove', handlePointerMove);
    window.removeEventListener('pointerup', handlePointerUp);
    canvas.removeEventListener('wheel', handleWheel);
  };

  return { camera, updateOrthographicFrustum, dispose };
};
