import { Color3, MeshBuilder, StandardMaterial, TransformNode, type Scene } from '@babylonjs/core';
import type { DungeonMapTileWorldLayout } from '@/core/scene';

export type DungeonAgentDebugMarker = {
  readonly root: TransformNode;
  setPose(position: readonly [number, number, number], yaw: number): void;
  dispose(): void;
};

/** 与玩家 Debug 使用相同的圆锥身体、球形头部和朝向四棱锥。 */
export const createDungeonAgentDebugMarker = (
  scene: Scene,
  id: string,
  layout: DungeonMapTileWorldLayout,
  bodyColorHex: string,
): DungeonAgentDebugMarker => {
  const safeId = id.replace(/[^a-zA-Z0-9_-]+/g, '_');
  const root = new TransformNode(`dungeon_agent_debug_${safeId}`, scene);
  const tileShortSide = Math.min(layout.size[0], layout.size[2]);
  const markerHeight = Math.max(layout.size[1] * 1.5, 1.2);
  const verticalOffset = layout.size[1] / 2;
  const bodyColor = Color3.FromHexString(bodyColorHex);
  const bodyMaterial = new StandardMaterial(`dungeon_agent_body_${safeId}`, scene);
  bodyMaterial.diffuseColor = bodyColor;
  bodyMaterial.emissiveColor = bodyColor.scale(0.38);
  const bodyBottomDiameter = Math.min(tileShortSide * 1.78, markerHeight * 0.72);
  const body = MeshBuilder.CreateCylinder(`dungeon_agent_body_${safeId}`, {
    height: markerHeight,
    diameterTop: markerHeight * 0.14,
    diameterBottom: bodyBottomDiameter,
    tessellation: 24,
  }, scene);
  body.position.y = verticalOffset + markerHeight / 2;
  body.material = bodyMaterial;
  body.parent = root;
  body.isPickable = false;

  const headDiameter = markerHeight * 0.72;
  const head = MeshBuilder.CreateSphere(`dungeon_agent_head_${safeId}`, {
    diameter: headDiameter,
    segments: 16,
  }, scene);
  head.position.y = verticalOffset + markerHeight + headDiameter * 0.45;
  head.material = bodyMaterial;
  head.parent = root;
  head.isPickable = false;

  const facingMaterial = new StandardMaterial(`dungeon_agent_facing_${safeId}`, scene);
  facingMaterial.diffuseColor = Color3.White();
  facingMaterial.emissiveColor = bodyColor.scale(0.7).add(Color3.White().scale(0.3));
  const facingLength = Math.min(tileShortSide * 0.22, markerHeight * 1.18);
  const facing = MeshBuilder.CreateCylinder(`dungeon_agent_facing_${safeId}`, {
    height: facingLength,
    diameterTop: 0,
    diameterBottom: Math.min(tileShortSide * 0.16, markerHeight * 0.62),
    tessellation: 4,
  }, scene);
  facing.rotation.x = Math.PI / 2;
  facing.position.set(
    0,
    verticalOffset + markerHeight * 0.72,
    bodyBottomDiameter / 2 + facingLength / 2 + tileShortSide * 0.14,
  );
  facing.material = facingMaterial;
  facing.parent = root;
  facing.isPickable = false;
  facing.enableEdgesRendering();
  facing.edgesColor.set(1, 1, 1, 1);
  facing.edgesWidth = 2;
  root.position.set(...layout.center);

  return {
    root,
    setPose(position, yaw) {
      root.position.set(...position);
      root.rotation.y = yaw;
    },
    dispose() { root.dispose(false, true); },
  };
};
