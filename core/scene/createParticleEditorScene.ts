import {
  ArcRotateCamera,
  Color3,
  Color4,
  Engine,
  HemisphericLight,
  MeshBuilder,
  Scene,
  StandardMaterial,
  Vector3
} from '@babylonjs/core';
import {
  DEFAULT_3D_CAMERA_ALPHA,
  DEFAULT_3D_CAMERA_BETA,
  DEFAULT_3D_CAMERA_RADIUS,
  ORTHO_HALF_HEIGHT
} from '@/core/particle/constants/particle.constants.ts';

export interface ParticleEditorSceneContext {
  engine: Engine;
  scene: Scene;
  camera: ArcRotateCamera;
  syncOrthographicFrustum: () => void;
  dispose: () => void;
}

export const createParticleEditorScene = (canvas: HTMLCanvasElement): ParticleEditorSceneContext => {
  const engine = new Engine(canvas, true);
  const scene = new Scene(engine);
  scene.clearColor = new Color4(0.12, 0.14, 0.19, 1);

  const camera = new ArcRotateCamera(
    'particle_editor_camera',
    DEFAULT_3D_CAMERA_ALPHA,
    DEFAULT_3D_CAMERA_BETA,
    DEFAULT_3D_CAMERA_RADIUS,
    Vector3.Zero(),
    scene
  );
  camera.attachControl(canvas, true);
  camera.wheelPrecision = 50;

  const light = new HemisphericLight('particle_editor_light', new Vector3(0, 1, 0), scene);
  light.intensity = 0.8;

  const ground = MeshBuilder.CreateGround('particle_editor_ground', { width: 10, height: 10 }, scene);
  const groundMaterial = new StandardMaterial('particle_editor_ground_mat', scene);
  groundMaterial.wireframe = true;
  groundMaterial.emissiveColor = new Color3(0.23, 0.28, 0.34);
  ground.material = groundMaterial;

  const emitterDebug = MeshBuilder.CreateSphere('particle_editor_emitter', { diameter: 0.16 }, scene);
  const emitterMaterial = new StandardMaterial('particle_editor_emitter_mat', scene);
  emitterMaterial.emissiveColor = new Color3(0.3, 0.8, 1);
  emitterDebug.material = emitterMaterial;
  emitterDebug.position = Vector3.Zero();

  const axesSize = 2;
  MeshBuilder.CreateLines('axis_x', {
    points: [new Vector3(0, 0, 0), new Vector3(axesSize, 0, 0)]
  }, scene).color = Color3.Red();
  MeshBuilder.CreateLines('axis_y', {
    points: [new Vector3(0, 0, 0), new Vector3(0, axesSize, 0)]
  }, scene).color = Color3.Green();
  MeshBuilder.CreateLines('axis_z', {
    points: [new Vector3(0, 0, 0), new Vector3(0, 0, axesSize)]
  }, scene).color = Color3.Blue();

  engine.runRenderLoop(() => scene.render());

  const syncOrthographicFrustum = () => {
    const ratio = engine.getRenderWidth() / Math.max(1, engine.getRenderHeight());
    camera.orthoTop = ORTHO_HALF_HEIGHT;
    camera.orthoBottom = -ORTHO_HALF_HEIGHT;
    camera.orthoLeft = -ORTHO_HALF_HEIGHT * ratio;
    camera.orthoRight = ORTHO_HALF_HEIGHT * ratio;
  };

  const dispose = () => {
    scene.dispose();
    engine.dispose();
  };

  return {
    engine,
    scene,
    camera,
    syncOrthographicFrustum,
    dispose
  };
};
