// utils/babylonHelpers.ts
import { Scene, Vector3, Matrix, Engine, ArcRotateCamera, MeshBuilder, Texture, Color3 } from '@babylonjs/core';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import type { TrackedUiState } from '@app-types/battle.types';
import { hiddenTrackedUi } from '@app-types/battle.types';

/**
 * 世界坐标转屏幕坐标
 * @param worldPos 世界坐标
 * @param scene Babylon场景
 * @param camera 相机
 * @param engine 引擎
 * @returns 屏幕坐标状态
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
    scale: 1, // 缩放由调用方计算
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
 * orthoHeight 越小代表越“放大”，scale 应越大
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
 * 创建图标平面
 */
export const createIconPlane = (
  scene: Scene, 
  texturePath: string, 
  baseSize: number = 2.5
) => {
  const plane = MeshBuilder.CreatePlane("plane", { size: 1 }, scene);
  const planeMaterial = new StandardMaterial("planeMat", scene);
  
  // 🛠️ 核心修改：使用显式参数创建 Texture 
  const iconTexture = new Texture(
    texturePath, 
    scene, 
    false,                         // 1. noMipmap = false (明确要求生成/启用 Mipmap)
    true,                          // 2. invertY = true (保持 Babylon 默认的 Y 轴翻转，可根据需要调整)
    Texture.TRILINEAR_SAMPLINGMODE // 3. samplingMode = 三线性过滤 (这是缩小查看时最平滑的过滤模式)
  );
  
  // 🛠️ 附加优化 1：开启各向异性过滤（最高设为 16），防止斜向或拉远视角下细节严重丢失模糊
  iconTexture.anisotropicFilteringLevel = 16;

  iconTexture.onLoadObservable.add(() => {
    const size = iconTexture.getSize(); 
    const aspectRatio = size.width / size.height;
    
    plane.scaling.x = baseSize * aspectRatio;
    plane.scaling.y = baseSize;
  });

  iconTexture.hasAlpha = true;
  iconTexture.wrapU = Texture.CLAMP_ADDRESSMODE;
  iconTexture.wrapV = Texture.CLAMP_ADDRESSMODE;

  planeMaterial.transparencyMode = 1;
  planeMaterial.diffuseTexture = iconTexture;
  planeMaterial.useAlphaFromDiffuseTexture = true;
  planeMaterial.diffuseColor = Color3.White();
  
  // 🛠️ 附加优化 2：关闭自发光对材质高光、环境的干扰，使 UI/精灵色彩完全不受环境光阴影影响
  planeMaterial.emissiveColor = Color3.White();
  planeMaterial.specularColor = new Color3(0, 0, 0);
  planeMaterial.ambientColor = Color3.White();
  
  planeMaterial.backFaceCulling = false;
  plane.material = planeMaterial;

  return plane;
};
/**
 * 获取方向向量
 */
export const getDirectionVector = (
  direction: 'up' | 'down' | 'left' | 'right' | 'forward' | 'backward' | Vector3
): Vector3 => {
  if (typeof direction === 'string') {
    const directionMap: Record<string, Vector3> = {
      'up': new Vector3(0, 1, 0),
      'down': new Vector3(0, -1, 0),
      'left': new Vector3(-1, 0, 0),
      'right': new Vector3(1, 0, 0),
      'forward': new Vector3(0, 0, 1),
      'backward': new Vector3(0, 0, -1)
    };
    return directionMap[direction] || new Vector3(0, 1, 0);
  }
  return direction.clone().normalize();
};