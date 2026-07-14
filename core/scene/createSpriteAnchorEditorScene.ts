import { ArcRotateCamera, Color4, Engine, HemisphericLight, Scene, Vector3 } from '@babylonjs/core';

export interface SpriteAnchorEditorSceneContext {
  engine: Engine;
  scene: Scene;
  camera: ArcRotateCamera;
  dispose: () => void;
}

export const createSpriteAnchorEditorScene = (canvas: HTMLCanvasElement): SpriteAnchorEditorSceneContext => {
  const engine = new Engine(canvas, true);
  const scene = new Scene(engine);
  scene.clearColor = new Color4(0.1, 0.1, 0.15, 1);

  const camera = new ArcRotateCamera('sprite_editor_camera', -Math.PI / 2, Math.PI / 2, 10, Vector3.Zero(), scene);
  camera.lowerAlphaLimit = -Math.PI / 2;
  camera.upperAlphaLimit = -Math.PI / 2;
  camera.lowerBetaLimit = Math.PI / 2;
  camera.upperBetaLimit = Math.PI / 2;
  camera.mode = ArcRotateCamera.ORTHOGRAPHIC_CAMERA;

  const light = new HemisphericLight('sprite_editor_light', new Vector3(0, 1, 0), scene);
  light.intensity = 0.7;

  const dispose = () => {
    scene.dispose();
    engine.dispose();
  };

  return {
    engine,
    scene,
    camera,
    dispose
  };
};
