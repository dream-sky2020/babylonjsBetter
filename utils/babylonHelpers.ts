export * from './cameraUtils';
export * from './spritePresetStorage';
export * from './meshFactory';
export * from './mockSprite';
// utils/babylonHelpers.ts
import { Scene, Vector3, Matrix, Engine, ArcRotateCamera, MeshBuilder, Texture, Color3, Mesh } from '@babylonjs/core';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import type { TrackedUiState } from '@app-types/battle.types';
import { spriteAnchorPresets } from '@app-config/spriteAnchorPresets';
import type { NormalizedUv, SpriteAnchorPreset, SpriteAnchorPresetMap } from '@app-types/sprite-anchors.types';
import { hiddenTrackedUi } from '@app-types/battle.types';

const SPRITE_ANCHOR_LOCAL_STORAGE_KEY = 'sprite-anchor-presets.v1';

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

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));

const clampUv = (uv: NormalizedUv): NormalizedUv => ({
  u: clamp01(uv.u),
  v: clamp01(uv.v)
});

const normalizeTexturePath = (texturePath: string): string => {
  const cleaned = texturePath.split('?')[0].split('#')[0];
  const decoded = decodeURI(cleaned);
  return decoded.replace(/^\/+/, '');
};

export const toSpritePresetKey = (texturePath: string): string => normalizeTexturePath(texturePath);

const createDefaultPreset = (imagePath: string): SpriteAnchorPreset => ({
  imagePath,
  bodyBounds: {
    minU: 0.2,
    maxU: 0.8,
    minV: 0.1,
    maxV: 0.96
  },
  bodyAxisX: 0.5,
  anchors: {
    head: { u: 0.5, v: 0.12 },
    foot: { u: 0.5, v: 0.95 },
    center: { u: 0.5, v: 0.54 }
  }
});

const sanitizePreset = (preset: SpriteAnchorPreset): SpriteAnchorPreset => {
  const minU = clamp01(Math.min(preset.bodyBounds.minU, preset.bodyBounds.maxU));
  const maxU = clamp01(Math.max(preset.bodyBounds.minU, preset.bodyBounds.maxU));
  const minV = clamp01(Math.min(preset.bodyBounds.minV, preset.bodyBounds.maxV));
  const maxV = clamp01(Math.max(preset.bodyBounds.minV, preset.bodyBounds.maxV));
  return {
    imagePath: normalizeTexturePath(preset.imagePath),
    bodyBounds: { minU, maxU, minV, maxV },
    bodyAxisX: clamp01(preset.bodyAxisX),
    anchors: {
      head: clampUv(preset.anchors.head),
      foot: clampUv(preset.anchors.foot),
      center: clampUv(preset.anchors.center)
    }
  };
};

const readLocalSpriteAnchorPresets = (): SpriteAnchorPresetMap => {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(SPRITE_ANCHOR_LOCAL_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as SpriteAnchorPresetMap;
    if (!parsed || typeof parsed !== 'object') return {};
    const result: SpriteAnchorPresetMap = {};
    Object.entries(parsed).forEach(([key, value]) => {
      if (!value) return;
      result[normalizeTexturePath(key)] = sanitizePreset(value);
    });
    return result;
  } catch {
    return {};
  }
};

export const saveSpriteAnchorPreset = (preset: SpriteAnchorPreset): void => {
  if (typeof window === 'undefined') return;
  const sanitized = sanitizePreset(preset);
  const saved = readLocalSpriteAnchorPresets();
  saved[sanitized.imagePath] = sanitized;
  window.localStorage.setItem(SPRITE_ANCHOR_LOCAL_STORAGE_KEY, JSON.stringify(saved));
};

export const removeSpriteAnchorPreset = (imagePath: string): void => {
  if (typeof window === 'undefined') return;
  const normalizedPath = normalizeTexturePath(imagePath);
  const saved = readLocalSpriteAnchorPresets();
  delete saved[normalizedPath];
  window.localStorage.setItem(SPRITE_ANCHOR_LOCAL_STORAGE_KEY, JSON.stringify(saved));
};

export const getLocalSpriteAnchorPreset = (texturePath: string): SpriteAnchorPreset | null => {
  const normalizedPath = normalizeTexturePath(texturePath);
  const local = readLocalSpriteAnchorPresets();
  const preset = local[normalizedPath];
  return preset ? sanitizePreset({ ...preset, imagePath: normalizedPath }) : null;
};

export const hasLocalSpriteAnchorPreset = (texturePath: string): boolean => {
  return getLocalSpriteAnchorPreset(texturePath) !== null;
};

export const getAllSpriteAnchorPresets = (): SpriteAnchorPresetMap => {
  const merged: SpriteAnchorPresetMap = {};
  Object.entries(spriteAnchorPresets).forEach(([key, value]) => {
    merged[normalizeTexturePath(key)] = sanitizePreset(value);
  });
  Object.entries(readLocalSpriteAnchorPresets()).forEach(([key, value]) => {
    merged[normalizeTexturePath(key)] = sanitizePreset(value);
  });
  return merged;
};

export type SpritePresetSource = 'merged' | 'config' | 'local';

export const getSpriteAnchorPreset = (
  texturePath: string,
  source: SpritePresetSource = 'merged'
): SpriteAnchorPreset => {
  const normalizedPath = normalizeTexturePath(texturePath);
  let preset: SpriteAnchorPreset | null = null;

  if (source === 'config') {
    const configPreset = spriteAnchorPresets[normalizedPath];
    preset = configPreset ? sanitizePreset(configPreset) : null;
  } else if (source === 'local') {
    preset = getLocalSpriteAnchorPreset(normalizedPath);
  } else {
    const merged = getAllSpriteAnchorPresets();
    preset = merged[normalizedPath] ?? null;
  }

  const resolvedPreset = preset ?? createDefaultPreset(normalizedPath);
  return sanitizePreset({ ...resolvedPreset, imagePath: normalizedPath });
};

export const uvToNormalizedAnchor = (uv: NormalizedUv): Vector3 => {
  const clamped = clampUv(uv);
  return new Vector3(clamped.u * 2 - 1, 1 - clamped.v * 2, 0);
};

export const getBodyAxisAlignedAnchorUv = (
  preset: SpriteAnchorPreset,
  anchorName: keyof SpriteAnchorPreset['anchors']
): NormalizedUv => {
  const anchor = preset.anchors[anchorName];
  const boundedV = Math.max(preset.bodyBounds.minV, Math.min(preset.bodyBounds.maxV, anchor.v));
  return {
    // 与编辑器可视化保持一致：使用锚点自身的 U 值，不再强制对齐 bodyAxisX
    u: clamp01(anchor.u),
    v: clamp01(boundedV)
  };
};

export type MockSprite = {
  mesh: Mesh;
  texturePath: string;
  preset: SpriteAnchorPreset;
  getAnchorUv: (anchorName: keyof SpriteAnchorPreset['anchors']) => NormalizedUv;
  getAnchorWorldPosition: (anchorName: keyof SpriteAnchorPreset['anchors']) => Vector3;
  refreshPreset: () => SpriteAnchorPreset;
};

const uvToPlaneLocal = (mesh: Mesh, uv: NormalizedUv): Vector3 => {
  const clamped = clampUv(uv);
  return new Vector3(
    (clamped.u - 0.5) * mesh.scaling.x,
    (0.5 - clamped.v) * mesh.scaling.y,
    0
  );
};

export const createMockSprite = (
  scene: Scene,
  texturePath: string,
  baseSize: number = 2.5,
  presetSource: SpritePresetSource = 'merged'
): MockSprite => {
  const mesh = createIconPlane(scene, texturePath, baseSize);
  let currentPreset = getSpriteAnchorPreset(texturePath, presetSource);

  return {
    mesh,
    texturePath: normalizeTexturePath(texturePath),
    preset: currentPreset,
    getAnchorUv(anchorName) {
      return getBodyAxisAlignedAnchorUv(currentPreset, anchorName);
    },
    getAnchorWorldPosition(anchorName) {
      const uv = getBodyAxisAlignedAnchorUv(currentPreset, anchorName);
      const localPos = uvToPlaneLocal(mesh, uv);
      return Vector3.TransformCoordinates(localPos, mesh.getWorldMatrix());
    },
    refreshPreset() {
      currentPreset = getSpriteAnchorPreset(texturePath, presetSource);
      this.preset = currentPreset;
      return currentPreset;
    }
  };
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


// 确保引入了之前的依赖，例如 Vector3, Scene, Mesh 等

/**
 * 为 MockSprite 绘制可视化的包围盒与锚点辅助线
 * @param mockSprite createMockSprite 返回的对象
 * @param scene 当前的 Babylon Scene
 * @returns 包含所有调试网格的数组，方便后续清理
 */
export const drawSpriteDebugHelper = (mockSprite: MockSprite, scene: Scene): Mesh[] => {
  const { mesh, preset } = mockSprite;
  const debugMeshes: Mesh[] = [];

  // 1. 提取包围盒数据
  const { minU, maxU, minV, maxV } = preset.bodyBounds;

  // 2. 借用现成的 uvToPlaneLocal 逻辑（或者内部再实现一遍）
  const getLocalPos = (u: number, v: number) => {
    return new Vector3(
      (u - 0.5) * mesh.scaling.x,
      (0.5 - v) * mesh.scaling.y, // 注意 V 轴是反向的
      -0.01 // 稍微往前凸一点，防止与平面产生 Z-fighting (深度冲突)
    );
  };

  // --- 绘制包围盒 (黄线) ---
  const pTL = getLocalPos(minU, minV); // 左上
  const pTR = getLocalPos(maxU, minV); // 右上
  const pBR = getLocalPos(maxU, maxV); // 右下
  const pBL = getLocalPos(minU, maxV); // 左下

  const boundsLine = MeshBuilder.CreateLines(`debug_bounds_${mockSprite.texturePath}`, {
    points: [pTL, pTR, pBR, pBL, pTL] // 闭合路线
  }, scene);
  boundsLine.color = Color3.Yellow();
  boundsLine.parent = mesh; // 核心：将其设为 Plane 的子节点，这样它会跟随 Plane 缩放和移动
  debugMeshes.push(boundsLine);

  // --- 绘制锚点 (小球) ---
  const createAnchorMarker = (name: string, u: number, v: number, color: Color3) => {
    const marker = MeshBuilder.CreateSphere(`debug_anchor_${name}`, { diameter: 0.05 }, scene);
    marker.position = getLocalPos(u, v);
    marker.parent = mesh;

    const mat = new StandardMaterial(`mat_${name}`, scene);
    mat.emissiveColor = color; // 使用自发光，不受光照影响
    mat.disableLighting = true;
    marker.material = mat;

    debugMeshes.push(marker);
  };

  // 绘制 Header(红), Center(蓝), Foot(绿)
  createAnchorMarker('head', preset.anchors.head.u, preset.anchors.head.v, Color3.Red());
  createAnchorMarker('center', preset.anchors.center.u, preset.anchors.center.v, Color3.Blue());
  createAnchorMarker('foot', preset.anchors.foot.u, preset.anchors.foot.v, Color3.Green());

  return debugMeshes;
};