// trackers/UiTracker.ts
import { Scene, ArcRotateCamera, Engine, Vector3, Mesh } from '@babylonjs/core';
import type { TrackedUiState, UiTrackerConfig } from '@app-types/battle.types';
import { worldToScreen, calculateScaleByDistance, calculateScaleByOrthoHeight, getDirectionVector } from '../utils/cameraUtils';

export const DEFAULT_UI_TRACKER_CONFIG: Required<UiTrackerConfig> = {
  offsetDirection: 'up',
  anchorMode: 'bounding',
  anchorNormalized: new Vector3(0, 0, 0),
  offsetMultiplier: 2,
  useBoundingEdgeOffset: true,
  extraOffset: 0.5,
  minScale: 0.65,
  maxScale: 2.2,
  baseDistance: 10,
  baseOrthoHeight: 10
};

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
    config: Partial<UiTrackerConfig> = {}
  ) {
    this.scene = scene;
    this.camera = camera;
    this.engine = engine;
    this.target = target;
    this.onUpdate = onUpdate;

    this.config = { ...DEFAULT_UI_TRACKER_CONFIG, ...config };
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

    const boundingInfo = this.target.getBoundingInfo();

    // 基础锚点：中心点（默认）或归一化锚点
    let baseAnchor = targetCenter;
    if (this.config.anchorMode === 'normalized') {
      const localExtendSize = boundingInfo.boundingBox.extendSize;
      const normalized = this.config.anchorNormalized;
      const clampedAnchor = new Vector3(
        Math.max(-1, Math.min(1, normalized.x)),
        Math.max(-1, Math.min(1, normalized.y)),
        Math.max(-1, Math.min(1, normalized.z))
      );
      const localAnchorPoint = new Vector3(
        localExtendSize.x * clampedAnchor.x,
        localExtendSize.y * clampedAnchor.y,
        localExtendSize.z * clampedAnchor.z
      );
      baseAnchor = Vector3.TransformCoordinates(localAnchorPoint, this.target.getWorldMatrix());
    }

    // 偏移距离：可选择是否按包围盒边缘贴边
    let offsetDistance = this.config.extraOffset;
    if (this.config.useBoundingEdgeOffset) {
      const extendSize = boundingInfo.boundingBox.extendSizeWorld;
      const axisWeight = new Vector3(
        Math.abs(worldDirection.x),
        Math.abs(worldDirection.y),
        Math.abs(worldDirection.z)
      );
      const halfExtentAlongDirection =
        extendSize.x * axisWeight.x +
        extendSize.y * axisWeight.y +
        extendSize.z * axisWeight.z;
      offsetDistance += halfExtentAlongDirection * this.config.offsetMultiplier;
    }

    // 计算锚点位置
    const anchorPoint = baseAnchor.add(worldDirection.scale(offsetDistance));

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