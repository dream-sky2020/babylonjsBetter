// trackers/UiTracker.ts
import { Scene, ArcRotateCamera, Engine, Vector3, Mesh } from '@babylonjs/core';
import type { TrackedUiState, UiTrackerConfig } from '@app-types/battle.types';
import { worldToScreen, calculateScaleByDistance, calculateScaleByOrthoHeight, getDirectionVector } from '../utils/babylonHelpers';

export class UiTracker {
  private scene: Scene;
  private camera: ArcRotateCamera;
  private engine: Engine;
  private target: Mesh;
  private config: Required<UiTrackerConfig>;
  private onUpdate: (state: TrackedUiState) => void;

  constructor(
    scene: Scene,
    camera: ArcRotateCamera,
    engine: Engine,
    target: Mesh,
    onUpdate: (state: TrackedUiState) => void,
    config: UiTrackerConfig = {}
  ) {
    this.scene = scene;
    this.camera = camera;
    this.engine = engine;
    this.target = target;
    this.onUpdate = onUpdate;

    // 默认配置
    this.config = {
      offsetDirection: 'up',
      offsetMultiplier: 2,
      extraOffset: 0.5,
      minScale: 0.65,
      maxScale: 2.2,
      baseDistance: 10,
      baseOrthoHeight: 10,
      ...config
    };
  }

  /** 更新追踪位置 */
  update(): void {
    const targetCenter = this.target.getAbsolutePosition();
    const direction = getDirectionVector(this.config.offsetDirection);
    
    // 如果是字符串方向，需要根据物体旋转进行变换
    let worldDirection: Vector3;
    if (typeof this.config.offsetDirection === 'string') {
      worldDirection = Vector3.TransformNormal(direction, this.target.getWorldMatrix());
      worldDirection.normalize();
    } else {
      worldDirection = direction.clone().normalize();
    }

    // 计算偏移距离
    const boundingInfo = this.target.getBoundingInfo();
    const extendSize = boundingInfo.boundingBox.extendSizeWorld;
    // 按方向投影到包围盒半径，确保“上/下/左/右”都贴着目标边缘偏移
    const axisWeight = new Vector3(
      Math.abs(worldDirection.x),
      Math.abs(worldDirection.y),
      Math.abs(worldDirection.z)
    );
    const halfExtentAlongDirection =
      extendSize.x * axisWeight.x +
      extendSize.y * axisWeight.y +
      extendSize.z * axisWeight.z;
    const offsetDistance = halfExtentAlongDirection * this.config.offsetMultiplier + this.config.extraOffset;

    // 计算锚点位置
    const anchorPoint = targetCenter.add(worldDirection.scale(offsetDistance));
    
    // 转换到屏幕坐标
    const screenPos = worldToScreen(anchorPoint, this.scene, this.camera, this.engine);
    
    // 计算缩放：透视相机按距离，正交相机按视口高度
    let scale: number;
    if (this.camera.mode === ArcRotateCamera.ORTHOGRAPHIC_CAMERA) {
      const orthoHeight = Math.abs((this.camera.orthoTop ?? 0) - (this.camera.orthoBottom ?? 0));
      scale = calculateScaleByOrthoHeight(
        orthoHeight,
        this.config.baseOrthoHeight,
        this.config.minScale,
        this.config.maxScale
      );
    } else {
      const distance = Vector3.Distance(this.camera.globalPosition, targetCenter);
      scale = calculateScaleByDistance(
        distance,
        this.config.baseDistance,
        this.config.minScale,
        this.config.maxScale
      );
    }

    // 更新UI状态
    this.onUpdate({
      ...screenPos,
      scale
    });
  }

  /** 更新配置 */
  updateConfig(config: Partial<UiTrackerConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /** 获取当前配置 */
  getConfig(): Required<UiTrackerConfig> {
    return { ...this.config };
  }

  /** 获取目标对象 */
  getTarget(): Mesh {
    return this.target;
  }

  /** 设置目标对象 */
  setTarget(target: Mesh): void {
    this.target = target;
  }
}