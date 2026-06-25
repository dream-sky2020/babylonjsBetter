import { ArcRotateCamera, Engine, Scene, Vector3 } from '@babylonjs/core';

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
  const camera = new ArcRotateCamera('camera', -Math.PI / 2, Math.PI / 2, 10, Vector3.Zero(), scene);
  camera.lowerAlphaLimit = -Math.PI / 2;
  camera.upperAlphaLimit = -Math.PI / 2;
  camera.lowerBetaLimit = Math.PI / 2;
  camera.upperBetaLimit = Math.PI / 2;
  camera.mode = ArcRotateCamera.ORTHOGRAPHIC_CAMERA;

  let orthoSize = 5;
  const minOrthoSize = 1.5;
  const maxOrthoSize = 14;
  const zoomStep = 0.1;

  const updateOrthographicFrustum = () => {
    const aspectRatio = engine.getRenderWidth() / engine.getRenderHeight();
    camera.orthoTop = orthoSize;
    camera.orthoBottom = -orthoSize;
    camera.orthoLeft = -orthoSize * aspectRatio;
    camera.orthoRight = orthoSize * aspectRatio;
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

    const worldWidth = (camera.orthoRight ?? 0) - (camera.orthoLeft ?? 0);
    const worldHeight = (camera.orthoTop ?? 0) - (camera.orthoBottom ?? 0);
    const worldPerPixelX = worldWidth / engine.getRenderWidth();
    const worldPerPixelY = worldHeight / engine.getRenderHeight();

    camera.target.addInPlace(new Vector3(-deltaX * worldPerPixelX, deltaY * worldPerPixelY, 0));
  };

  const handlePointerUp = () => {
    isDragging = false;
  };

  const handleWheel = (event: WheelEvent) => {
    event.preventDefault();
    const direction = Math.sign(event.deltaY);
    if (direction === 0) return;

    const nextOrthoSize = orthoSize * (1 + direction * zoomStep);
    orthoSize = Math.min(maxOrthoSize, Math.max(minOrthoSize, nextOrthoSize));
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
