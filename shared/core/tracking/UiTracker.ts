import { ArcRotateCamera, Engine, Mesh, Scene, Vector3 } from '@babylonjs/core';
import type { TrackedUiState, UiTrackerConfig } from '../types/battle.types';
import {
  calculateScaleByDistance,
  calculateScaleByOrthoHeight,
  getDirectionVector,
  worldToScreen
} from './cameraUtils';

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

    let worldDirection: Vector3;
    if (typeof this.config.offsetDirection === 'string') {
      worldDirection = Vector3.TransformNormal(direction, this.target.getWorldMatrix());
      worldDirection.normalize();
    } else {
      worldDirection = direction.clone().normalize();
    }

    const boundingInfo = this.target.getBoundingInfo();

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

    const anchorPoint = baseAnchor.add(worldDirection.scale(offsetDistance));
    const screenPos = worldToScreen(anchorPoint, this.scene, this.camera, this.engine);

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
