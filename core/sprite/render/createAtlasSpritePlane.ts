import { Color3, Mesh, Scene, Texture, VertexData } from '@babylonjs/core';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import type { IconPlaneController, SpriteFrameRegion } from '@/core/sprite/types/sprite.types.ts';
import {
  acquireSharedAtlasTexture,
  releaseSharedAtlasTexture
} from '@/core/sprite/render/sharedAtlasTexture.ts';
import {
  DEFAULT_SPRITE_VISUAL_SURFACE_FACTORY,
  type SpriteVisualSurfaceFactory,
  type SpriteVisualSurfaceRole
} from './spriteVisualSurface.ts';
import type { SpriteVisualEffectState } from './spriteVisualEffect.types.ts';
import { resolveAppAssetUrl } from '@/core/resources/appAssetUrl.ts';

export type CreateAtlasSpritePlaneOptions = {
  /** 同一 atlas 路径共享 GPU 纹理（多部件推荐开启） */
  shareTexture?: boolean;
  /** 世界单位 / 像素，用于按 sourceSize 自动换算尺寸 */
  worldUnitsPerPixel?: number;
  /** 顶点变形需要细分网格；普通图标保持 1 可避免额外顶点成本。 */
  subdivisions?: number;
  /** 只声明视觉角色；具体使用普通材质还是组合 Shader 由 Surface 工厂决定。 */
  surfaceRole?: SpriteVisualSurfaceRole;
  surfaceName?: string;
  initialEffects?: SpriteVisualEffectState;
  surfaceFactory?: SpriteVisualSurfaceFactory;
};

export const normalizeSpritePlaneSubdivisions = (value: number, fallback = 12) =>
  Math.max(1, Math.min(128, Math.round(Number.isFinite(value) ? value : fallback)));

export const applySubdividedPlaneGeometry = (mesh: Mesh, subdivisions: number) => {
  const count = normalizeSpritePlaneSubdivisions(subdivisions);
  const positions: number[] = [], uvs: number[] = [], normals: number[] = [], indices: number[] = [];
  for (let y = 0; y <= count; y++) for (let x = 0; x <= count; x++) {
    const u = x / count, v = y / count;
    positions.push(u - .5, v - .5, 0); uvs.push(u, v); normals.push(0, 0, 1);
  }
  const stride = count + 1;
  for (let y = 0; y < count; y++) for (let x = 0; x < count; x++) {
    const a = y * stride + x, b = a + 1, d = a + stride, c = d + 1;
    indices.push(a, b, c, a, c, d);
  }
  const data = new VertexData();
  data.positions = positions; data.uvs = uvs; data.normals = normals; data.indices = indices; data.applyToMesh(mesh, true);
  return count;
};

/**
 * 创建图标平面并配置材质与纹理采样参数。
 */
export const createAtlasSpritePlane = (
  scene: Scene,
  texturePath: string,
  baseSize: number = 2.5,
  options: CreateAtlasSpritePlaneOptions = {}
): IconPlaneController => {
  const shareTexture = options.shareTexture === true;
  const worldUnitsPerPixel = options.worldUnitsPerPixel;
  const plane = new Mesh('plane', scene);
  let subdivisions = applySubdividedPlaneGeometry(plane, options.subdivisions ?? 1);
  const planeMaterial = new StandardMaterial('planeMat', scene);
  let currentRegion: SpriteFrameRegion | null = null;
  let displayScale = 1;

  const iconTexture = shareTexture
    ? acquireSharedAtlasTexture(scene, texturePath)
    : new Texture(resolveAppAssetUrl(texturePath), scene, false, true, Texture.TRILINEAR_SAMPLINGMODE);

  if (!shareTexture) {
    iconTexture.hasAlpha = true;
    iconTexture.wrapU = Texture.CLAMP_ADDRESSMODE;
    iconTexture.wrapV = Texture.CLAMP_ADDRESSMODE;
  }

  const toDisplaySize = (
    region: SpriteFrameRegion | null,
    textureWidth: number,
    textureHeight: number
  ): { width: number; height: number } => {
    if (!region) {
      return {
        width: Math.max(1, textureWidth),
        height: Math.max(1, textureHeight)
      };
    }
    const sourceW = region.sourceSize?.w;
    const sourceH = region.sourceSize?.h;
    if (Number.isFinite(sourceW) && Number.isFinite(sourceH) && sourceW > 0 && sourceH > 0) {
      return { width: sourceW, height: sourceH };
    }
    return {
      width: Math.max(1, region.spriteSourceSize.w),
      height: Math.max(1, region.spriteSourceSize.h)
    };
  };

  const applyPlaneScale = (region: SpriteFrameRegion | null) => {
    const textureSize = iconTexture.getSize();
    const { width: displayWidth, height: displayHeight } = toDisplaySize(
      region,
      textureSize.width,
      textureSize.height
    );
    if (typeof worldUnitsPerPixel === 'number' && Number.isFinite(worldUnitsPerPixel) && worldUnitsPerPixel > 0) {
      plane.scaling.x = displayWidth * worldUnitsPerPixel * displayScale;
      plane.scaling.y = displayHeight * worldUnitsPerPixel * displayScale;
      return;
    }
    const aspectRatio = Math.max(0.0001, displayWidth / Math.max(1, displayHeight));
    plane.scaling.x = baseSize * aspectRatio * displayScale;
    plane.scaling.y = baseSize * displayScale;
  };

  const applyTextureRegion = (region: SpriteFrameRegion | null) => {
    if (!region) {
      iconTexture.uOffset = 0;
      iconTexture.vOffset = 0;
      iconTexture.uScale = 1;
      iconTexture.vScale = 1;
      applyPlaneScale(null);
      return;
    }

    const atlasWidth = Math.max(1, region.atlasSize.w);
    const atlasHeight = Math.max(1, region.atlasSize.h);
    const frameWidth = Math.max(1, region.frame.w);
    const frameHeight = Math.max(1, region.frame.h);

    iconTexture.uOffset = region.frame.x / atlasWidth;
    iconTexture.uScale = frameWidth / atlasWidth;
    iconTexture.vScale = frameHeight / atlasHeight;
    iconTexture.vOffset = 1 - (region.frame.y + frameHeight) / atlasHeight;

    applyPlaneScale(region);
  };

  iconTexture.onLoadObservable.add(() => {
    applyTextureRegion(currentRegion);
    const loadedSize = iconTexture.getSize();
    surface.setRenderSize(Math.max(1, loadedSize.width), Math.max(1, loadedSize.height));
  });

  // 叠层部件需要半透明混合，AlphaTest 会导致边缘发硬/锯齿明显
  planeMaterial.transparencyMode = 2;
  planeMaterial.diffuseTexture = iconTexture;
  planeMaterial.emissiveTexture = iconTexture;
  planeMaterial.useAlphaFromDiffuseTexture = true;
  planeMaterial.diffuseColor = Color3.Black();
  planeMaterial.emissiveColor = Color3.White();
  planeMaterial.specularColor = new Color3(0, 0, 0);
  planeMaterial.ambientColor = Color3.White();
  planeMaterial.disableLighting = true;
  planeMaterial.backFaceCulling = false;

  const surface = (options.surfaceFactory ?? DEFAULT_SPRITE_VISUAL_SURFACE_FACTORY).create(scene, {
    role: options.surfaceRole ?? 'generic-sprite',
    name: options.surfaceName ?? 'sprite_surface',
    sourceTexture: iconTexture,
    baseMaterial: planeMaterial,
    effects: options.initialEffects,
    renderSizePx: iconTexture.getSize()
  });
  plane.material = surface.material;
  applyTextureRegion(null);

  return {
    mesh: plane,
    texture: iconTexture,
    surface,
    getDisplayScale: () => displayScale,
    setDisplayScale: (scale: number) => {
      displayScale = Math.max(0.01, Number.isFinite(scale) ? scale : 1);
      applyPlaneScale(currentRegion);
    },
    getSubdivisions: () => subdivisions,
    setSubdivisions: (next) => {
      const normalized = normalizeSpritePlaneSubdivisions(next);
      if (normalized === subdivisions) return;
      subdivisions = applySubdividedPlaneGeometry(plane, normalized);
    },
    getFrameRegion: () => currentRegion,
    setFrameRegion: (region: SpriteFrameRegion | null) => {
      currentRegion = region;
      applyTextureRegion(region);
    },
    dispose: () => {
      surface.dispose();
      iconTexture.dispose();
      if (shareTexture) {
        releaseSharedAtlasTexture(texturePath);
      }
      plane.dispose();
    }
  };
};
