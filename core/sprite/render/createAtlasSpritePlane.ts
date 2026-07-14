import { Color3, MeshBuilder, Scene, Texture } from '@babylonjs/core';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import type { IconPlaneController, SpriteFrameRegion } from '@/core/sprite/types/sprite.types.ts';

/**
 * 创建图标平面并配置材质与纹理采样参数。
 */
export const createAtlasSpritePlane = (
  scene: Scene,
  texturePath: string,
  baseSize: number = 2.5
): IconPlaneController => {
  const plane = MeshBuilder.CreatePlane('plane', { size: 1 }, scene);
  const planeMaterial = new StandardMaterial('planeMat', scene);
  let currentRegion: SpriteFrameRegion | null = null;

  const iconTexture = new Texture(
    texturePath,
    scene,
    false,
    true,
    Texture.TRILINEAR_SAMPLINGMODE
  );

  const applyPlaneScale = (region: SpriteFrameRegion | null) => {
    const textureSize = iconTexture.getSize();
    const displayWidth = region?.spriteSourceSize.w ?? Math.max(1, textureSize.width);
    const displayHeight = region?.spriteSourceSize.h ?? Math.max(1, textureSize.height);
    const aspectRatio = Math.max(0.0001, displayWidth / Math.max(1, displayHeight));
    plane.scaling.x = baseSize * aspectRatio;
    plane.scaling.y = baseSize;
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
  });

  iconTexture.hasAlpha = true;
  iconTexture.wrapU = Texture.CLAMP_ADDRESSMODE;
  iconTexture.wrapV = Texture.CLAMP_ADDRESSMODE;

  planeMaterial.transparencyMode = 1;
  planeMaterial.diffuseTexture = iconTexture;
  planeMaterial.useAlphaFromDiffuseTexture = true;
  planeMaterial.diffuseColor = Color3.White();
  planeMaterial.emissiveColor = Color3.White();
  planeMaterial.specularColor = new Color3(0, 0, 0);
  planeMaterial.ambientColor = Color3.White();
  planeMaterial.backFaceCulling = false;

  plane.material = planeMaterial;
  applyTextureRegion(null);

  return {
    mesh: plane,
    texture: iconTexture,
    getFrameRegion: () => currentRegion,
    setFrameRegion: (region: SpriteFrameRegion | null) => {
      currentRegion = region;
      applyTextureRegion(region);
    }
  };
};
