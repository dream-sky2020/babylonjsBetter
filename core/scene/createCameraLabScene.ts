import {
  ArcRotateCamera,
  Color3,
  Color4,
  Engine,
  HemisphericLight,
  MeshBuilder,
  Scene,
  TransformNode,
  Vector3
} from '@babylonjs/core';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';

export interface CameraLabSceneContext {
  engine: Engine;
  scene: Scene;
  camera: ArcRotateCamera;
  root: TransformNode;
  dispose: () => void;
}

export const createRoadSceneEnvironment = (scene: Scene): void => {
  const groundY = -2.25;
  const roadY = -2.16;
  const roadDetailY = -2.135;
  const ground = MeshBuilder.CreateGround('camera_lab_ground', { width: 520, height: 920 }, scene);
  const groundMat = new StandardMaterial('camera_lab_ground_mat', scene);
  groundMat.diffuseColor = new Color3(0.36, 0.46, 0.34);
  groundMat.specularColor = new Color3(0, 0, 0);
  ground.material = groundMat;
  ground.position.y = groundY;
  ground.position.z = -280;

  const road = MeshBuilder.CreateGround('camera_lab_road', { width: 16, height: 760 }, scene);
  const roadMat = new StandardMaterial('camera_lab_road_mat', scene);
  roadMat.diffuseColor = new Color3(0.12, 0.13, 0.15);
  roadMat.specularColor = new Color3(0, 0, 0);
  road.material = roadMat;
  road.position.y = roadY;
  road.position.z = -300;

  const edgeMat = new StandardMaterial('camera_lab_road_edge_mat', scene);
  edgeMat.diffuseColor = new Color3(0.86, 0.84, 0.68);
  edgeMat.specularColor = new Color3(0, 0, 0);
  for (const x of [-7.6, 7.6]) {
    const edge = MeshBuilder.CreateBox(`camera_lab_road_edge_${x}`, { width: 0.16, height: 0.01, depth: 740 }, scene);
    edge.material = edgeMat;
    edge.position.set(x, roadDetailY, -300);
  }

  for (let i = 0; i < 72; i += 1) {
    const mark = MeshBuilder.CreateBox(`camera_lab_lane_mark_${i}`, { width: 0.32, height: 0.01, depth: 5.2 }, scene);
    const markMat = new StandardMaterial(`camera_lab_lane_mark_mat_${i}`, scene);
    markMat.diffuseColor = new Color3(0.95, 0.9, 0.55);
    markMat.specularColor = new Color3(0, 0, 0);
    mark.material = markMat;
    mark.position.set(0, roadDetailY + 0.006, 24 - i * 10.2);
  }

  const blockMat = new StandardMaterial('camera_lab_block_mat', scene);
  blockMat.specularColor = new Color3(0, 0, 0);
  for (let i = 0; i < 150; i += 1) {
    const base = i * 1.37;
    const side = i % 2 === 0 ? -1 : 1;
    const x = side * (18 + (i % 8) * 2.4 + Math.abs(Math.sin(base * 0.73)) * 18);
    const z = 4 - (i % 25) * 7.5 - Math.floor(i / 25) * 24;
    const h = 2.2 + (i % 11) * 0.7;
    const w = 1.5 + (i % 5) * 0.55;
    const d = 1.5 + (i % 4) * 0.7;
    const tower = MeshBuilder.CreateBox(`camera_lab_tower_${i}`, { width: w, depth: d, height: h }, scene);
    tower.position.set(x, groundY + h * 0.5, z);
    const shade = 0.28 + (i % 7) * 0.035;
    const towerMat = blockMat.clone(`camera_lab_block_mat_${i}`);
    towerMat.diffuseColor = new Color3(shade * 0.8, shade * 0.9, shade);
    tower.material = towerMat;
  }

  const mountainMat = new StandardMaterial('camera_lab_mountain_mat', scene);
  mountainMat.diffuseColor = new Color3(0.35, 0.42, 0.5);
  mountainMat.specularColor = new Color3(0, 0, 0);
  for (let i = 0; i < 30; i += 1) {
    const base = i * 1.91;
    const x = -230 + i * 16 + Math.sin(base) * 10;
    const z = -380 - (i % 5) * 24 - Math.cos(base * 0.63) * 18;
    const height = 32 + (i % 7) * 9;
    const diameter = 32 + (i % 6) * 8;
    const mountain = MeshBuilder.CreateCylinder(`camera_lab_mountain_${i}`, {
      height,
      diameterTop: 0,
      diameterBottom: diameter,
      tessellation: 6
    }, scene);
    const clonedMountainMat = mountainMat.clone(`camera_lab_mountain_mat_${i}`);
    const shade = 0.85 + (i % 4) * 0.08;
    clonedMountainMat.diffuseColor = new Color3(0.28 * shade, 0.35 * shade, 0.45 * shade);
    mountain.material = clonedMountainMat;
    mountain.position.set(x, groundY + height * 0.5, z);
  }
};

export const createCameraLabScene = (canvas: HTMLCanvasElement): CameraLabSceneContext => {
  const engine = new Engine(canvas, true, { preserveDrawingBuffer: true, stencil: true });
  const scene = new Scene(engine);
  scene.clearColor = new Color4(0.57, 0.78, 0.98, 1);

  const camera = new ArcRotateCamera('cameraLabCamera', Math.PI / 2, 1.36, 42, new Vector3(0, -0.15, -18), scene);
  camera.inputs.clear();
  camera.fov = 0.43;
  camera.minZ = 0.05;
  camera.maxZ = 1500;

  const light = new HemisphericLight('cameraLabLight', new Vector3(0, 1, 0), scene);
  light.intensity = 0.95;
  light.groundColor = new Color3(0.32, 0.35, 0.3);

  const root = new TransformNode('cameraLabRoot', scene);
  createRoadSceneEnvironment(scene);

  const dispose = () => {
    scene.dispose();
    engine.dispose();
  };

  return { engine, scene, camera, root, dispose };
};
