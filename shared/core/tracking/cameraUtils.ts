import { ArcRotateCamera, Engine, Matrix, Scene, Vector3 } from '@babylonjs/core';
import type { TrackedUiState } from '../types/battle.types';
import { hiddenTrackedUi } from '../types/battle.types';

/**
 * 世界坐标转屏幕坐标
 */
export const worldToScreen = (
  worldPos: Vector3,
  scene: Scene,
  camera: ArcRotateCamera,
  engine: Engine
): TrackedUiState => {
  const engineWidth = engine.getRenderWidth();
  const engineHeight = engine.getRenderHeight();
  const globalViewport = camera.viewport.toGlobal(engineWidth, engineHeight);

  const projected = Vector3.Project(
    worldPos,
    Matrix.Identity(),
    scene.getTransformMatrix(),
    globalViewport
  );

  if (projected.z < 0 || projected.z > 1) {
    return hiddenTrackedUi;
  }

  return {
    x: projected.x,
    y: projected.y,
    scale: 1,
    visible: true
  };
};

/**
 * 计算基于距离的缩放值
 */
export const calculateScaleByDistance = (
  distance: number,
  baseDistance: number = 10,
  minScale: number = 0.65,
  maxScale: number = 2.2
): number => {
  return Math.min(maxScale, Math.max(minScale, baseDistance / Math.max(distance, 0.001)));
};

/**
 * 正交相机：按视口高度等比缩放
 */
export const calculateScaleByOrthoHeight = (
  orthoHeight: number,
  baseOrthoHeight: number = 10,
  minScale: number = 0.65,
  maxScale: number = 2.2
): number => {
  const normalized = baseOrthoHeight / Math.max(orthoHeight, 0.001);
  return Math.min(maxScale, Math.max(minScale, normalized));
};

/**
 * 获取方向向量
 */
export const getDirectionVector = (
  direction: 'up' | 'down' | 'left' | 'right' | 'forward' | 'backward' | Vector3
): Vector3 => {
  if (typeof direction === 'string') {
    const directionMap: Record<string, Vector3> = {
      up: new Vector3(0, 1, 0),
      down: new Vector3(0, -1, 0),
      left: new Vector3(-1, 0, 0),
      right: new Vector3(1, 0, 0),
      forward: new Vector3(0, 0, 1),
      backward: new Vector3(0, 0, -1)
    };
    return directionMap[direction] || new Vector3(0, 1, 0);
  }
  return direction.clone().normalize();
};
