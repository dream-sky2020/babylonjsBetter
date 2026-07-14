import { Color3, Mesh, MeshBuilder, Scene, Vector3 } from '@babylonjs/core';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import type { SpriteEntity } from '@/core/sprite/entity/createSpriteEntity.ts';

/**
 * 为 SpriteEntity 绘制可视化的包围盒与锚点辅助线。
 */
export const drawSpriteDebugOverlay = (mockSprite: SpriteEntity, scene: Scene): Mesh[] => {
  const { mesh, preset } = mockSprite;
  const debugMeshes: Mesh[] = [];
  const { minU, maxU, minV, maxV } = preset.bodyBounds;
  const lightBlue = new Color3(0.68, 0.85, 1);

  const getLocalPos = (u: number, v: number) => {
    return new Vector3(u - 0.5, 0.5 - v, -0.01);
  };

  const pTL = getLocalPos(minU, minV);
  const pTR = getLocalPos(maxU, minV);
  const pBR = getLocalPos(maxU, maxV);
  const pBL = getLocalPos(minU, maxV);

  const planeTL = getLocalPos(0, 0);
  const planeTR = getLocalPos(1, 0);
  const planeBR = getLocalPos(1, 1);
  const planeBL = getLocalPos(0, 1);
  const planeEdgeLine = MeshBuilder.CreateLines(
    `debug_plane_edge_${mockSprite.texturePath}`,
    {
      points: [planeTL, planeTR, planeBR, planeBL, planeTL]
    },
    scene
  );
  planeEdgeLine.color = lightBlue;
  planeEdgeLine.parent = mesh;
  debugMeshes.push(planeEdgeLine);

  const boundsLine = MeshBuilder.CreateLines(
    `debug_bounds_${mockSprite.texturePath}`,
    {
      points: [pTL, pTR, pBR, pBL, pTL]
    },
    scene
  );
  boundsLine.color = Color3.Yellow();
  boundsLine.parent = mesh;
  debugMeshes.push(boundsLine);

  const axisTop = getLocalPos(preset.bodyAxisX, 0);
  const axisBottom = getLocalPos(preset.bodyAxisX, 1);
  const axisLine = MeshBuilder.CreateLines(
    `debug_axis_${mockSprite.texturePath}`,
    {
      points: [axisTop, axisBottom]
    },
    scene
  );
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
