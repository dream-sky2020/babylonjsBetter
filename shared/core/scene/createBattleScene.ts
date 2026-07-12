import { ArcRotateCamera, Color4, Engine, HemisphericLight, Scene, Vector3 } from '@babylonjs/core';

export interface BattleCameraControllerContext {
  camera: ArcRotateCamera;
  updateOrthographicFrustum: () => void;
  dispose: () => void;
}

export type BattleCameraControllerFactory = (
  scene: Scene,
  engine: Engine,
  canvas: HTMLCanvasElement
) => BattleCameraControllerContext;

export interface BattleSceneContext {
  engine: Engine;
  scene: Scene;
  camera: ArcRotateCamera;
  updateOrthographicFrustum: () => void;
  dispose: () => void;
}

export const createBattleScene = (
  canvas: HTMLCanvasElement,
  createCameraController: BattleCameraControllerFactory
): BattleSceneContext => {
  const engine = new Engine(canvas, true);
  const scene = new Scene(engine);
  scene.clearColor = new Color4(0.1, 0.1, 0.15, 1);

  const {
    camera,
    updateOrthographicFrustum,
    dispose: disposeCameraController
  } = createCameraController(scene, engine, canvas);

  const light = new HemisphericLight('light', new Vector3(0, 1, 0), scene);
  light.intensity = 0.7;

  const dispose = () => {
    disposeCameraController();
    scene.dispose();
    engine.dispose();
  };

  return { engine, scene, camera, updateOrthographicFrustum, dispose };
};
