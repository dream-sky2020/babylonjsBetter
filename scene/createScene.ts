import { createBattleCameraController } from '../cameraController/CameraController';
import {
  createBattleScene as createCoreBattleScene,
  type BattleSceneContext
} from '../shared/core/scene/createBattleScene';

export const createBattleScene = (canvas: HTMLCanvasElement): BattleSceneContext => {
  return createCoreBattleScene(canvas, createBattleCameraController);
};
