import { Color3, MeshBuilder, Scene, Texture } from '@babylonjs/core';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';

/**
 * 创建图标平面并配置材质与纹理采样参数。
 */
export const createIconPlane = (
  scene: Scene,
  texturePath: string,
  baseSize: number = 2.5
) => {
  const plane = MeshBuilder.CreatePlane('plane', { size: 1 }, scene);
  const planeMaterial = new StandardMaterial('planeMat', scene);

  const iconTexture = new Texture(
    texturePath,
    scene,
    false,
    true,
    Texture.TRILINEAR_SAMPLINGMODE
  );

  // 统一渲染参数：提升斜视角采样质量。
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
  planeMaterial.emissiveColor = Color3.White();
  planeMaterial.specularColor = new Color3(0, 0, 0);
  planeMaterial.ambientColor = Color3.White();
  planeMaterial.backFaceCulling = false;

  plane.material = planeMaterial;
  return plane;
};
