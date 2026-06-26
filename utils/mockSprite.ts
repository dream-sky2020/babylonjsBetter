import { Color3, Mesh, MeshBuilder, Scene, Vector3 } from '@babylonjs/core';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import type { NormalizedUv, SpriteAnchorPreset } from '@app-types/sprite-anchors.types';
import { createIconPlane, type SpriteFrameRegion } from './meshFactory';
import { getSpriteAnchorPreset, toSpritePresetKey, type SpritePresetSource } from './spritePresetStorage';

export const uvToNormalizedAnchor = (uv: NormalizedUv): Vector3 => {
  return new Vector3(uv.u * 2 - 1, 1 - uv.v * 2, 0);
};

export const getBodyAxisAlignedAnchorUv = (
  preset: SpriteAnchorPreset,
  anchorName: keyof SpriteAnchorPreset['anchors']
): NormalizedUv => {
  const anchor = preset.anchors[anchorName];
  return {
    u: anchor.u,
    v: anchor.v
  };
};

export type MockSprite = {
  mesh: Mesh;
  texturePath: string;
  preset: SpriteAnchorPreset;
  frameRegion: SpriteFrameRegion | null;
  setFrameRegion: (frameRegion: SpriteFrameRegion | null) => void;
  getAnchorUv: (anchorName: keyof SpriteAnchorPreset['anchors']) => NormalizedUv;
  getAnchorWorldPosition: (anchorName: keyof SpriteAnchorPreset['anchors']) => Vector3;
  refreshPreset: () => SpriteAnchorPreset;
};

const uvToPlaneLocal = (_mesh: Mesh, uv: NormalizedUv): Vector3 => {
  return new Vector3(
    uv.u - 0.5,
    0.5 - uv.v,
    0
  );
};

export const createMockSprite = (
  scene: Scene,
  texturePath: string,
  baseSize: number = 2.5,
  presetSource: SpritePresetSource = 'merged',
  frameRegion: SpriteFrameRegion | null = null
): MockSprite => {
  const iconPlane = createIconPlane(scene, texturePath, baseSize);
  const mesh = iconPlane.mesh;
  iconPlane.setFrameRegion(frameRegion);
  let currentPreset = getSpriteAnchorPreset(texturePath, presetSource);

  return {
    mesh,
    texturePath: toSpritePresetKey(texturePath),
    preset: currentPreset,
    frameRegion,
    setFrameRegion(nextFrameRegion) {
      this.frameRegion = nextFrameRegion;
      iconPlane.setFrameRegion(nextFrameRegion);
    },
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
 * 为 MockSprite 绘制可视化的包围盒与锚点辅助线。
 */
export const drawSpriteDebugHelper = (mockSprite: MockSprite, scene: Scene): Mesh[] => {
  const { mesh, preset } = mockSprite;
  const debugMeshes: Mesh[] = [];
  const { minU, maxU, minV, maxV } = preset.bodyBounds;

  const getLocalPos = (u: number, v: number) => {
    return new Vector3(
      u - 0.5,
      0.5 - v,
      -0.01
    );
  };

  const pTL = getLocalPos(minU, minV);
  const pTR = getLocalPos(maxU, minV);
  const pBR = getLocalPos(maxU, maxV);
  const pBL = getLocalPos(minU, maxV);

  const boundsLine = MeshBuilder.CreateLines(`debug_bounds_${mockSprite.texturePath}`, {
    points: [pTL, pTR, pBR, pBL, pTL]
  }, scene);
  boundsLine.color = Color3.Yellow();
  boundsLine.parent = mesh;
  debugMeshes.push(boundsLine);

  // 身体中轴线：贯穿整个平面高度，不再只覆盖 bodyBounds 区域。
  const axisTop = getLocalPos(preset.bodyAxisX, 0);
  const axisBottom = getLocalPos(preset.bodyAxisX, 1);
  const axisLine = MeshBuilder.CreateLines(`debug_axis_${mockSprite.texturePath}`, {
    points: [axisTop, axisBottom]
  }, scene);
  axisLine.color = new Color3(0.82, 0.5, 1);
  axisLine.parent = mesh;
  debugMeshes.push(axisLine);

  const createAnchorMarker = (name: string, u: number, v: number, color: Color3) => {
    const marker = MeshBuilder.CreateSphere(`debug_anchor_${name}`, { diameter: 0.05 }, scene);
    marker.position = getLocalPos(u, v);
    marker.parent = mesh;

    const material = new StandardMaterial(`mat_${name}`, scene);
    material.emissiveColor = color;
    material.disableLighting = true;
    marker.material = material;

    debugMeshes.push(marker);
  };

  createAnchorMarker('head', preset.anchors.head.u, preset.anchors.head.v, Color3.Red());
  createAnchorMarker('center', preset.anchors.center.u, preset.anchors.center.v, Color3.Blue());
  createAnchorMarker('foot', preset.anchors.foot.u, preset.anchors.foot.v, Color3.Green());

  return debugMeshes;
};
