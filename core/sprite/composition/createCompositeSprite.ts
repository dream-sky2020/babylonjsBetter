import { Color3, TransformNode, type Scene } from '@babylonjs/core';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import type { TexturePackerAtlas } from '@/core/sprite/editor/spriteAnchorEditorHelpers.ts';
import { toFrameRegion } from '@/core/sprite/editor/spriteAnchorEditorHelpers.ts';
import { createAtlasSpritePlane } from '@/core/sprite/render/createAtlasSpritePlane.ts';
import type { IconPlaneController, SpriteFrameRegion } from '@/core/sprite/types/sprite.types.ts';
import {
  DEFAULT_SPRITE_TRANSFORM,
  type SpritePartDef,
  type SpritePartPose,
  type SpriteRigDef,
  type SpriteTransform2D
} from '@/core/sprite/types/sprite-animation.types.ts';
import { resolvePartAtlas } from '@/core/sprite/composition/resolvePartAtlas.ts';

/** atlasJsonPath -> 已加载图集 */
export type AtlasBundle = Record<string, TexturePackerAtlas>;

export type CreateCompositeSpriteOptions = {
  nameSuffix?: string;
  pickable?: boolean;
  /** 附加到所有部件 position.z，残影层用负值压到后方 */
  zBias?: number;
};

export type CompositeSpritePart = {
  partId: string;
  def: SpritePartDef;
  atlasJsonPath: string;
  atlasImagePath: string;
  plane: IconPlaneController;
  getPose: () => Required<SpritePartPose>;
  applyPose: (pose: SpritePartPose) => void;
  setFrameName: (frameName: string | null) => void;
  setHighlighted: (highlighted: boolean) => void;
};

export type CompositeSprite = {
  root: TransformNode;
  rig: SpriteRigDef;
  atlases: AtlasBundle;
  parts: Map<string, CompositeSpritePart>;
  getPart: (partId: string) => CompositeSpritePart | undefined;
  getPartByMeshUniqueId: (uniqueId: number) => CompositeSpritePart | undefined;
  applyPoseMap: (poseMap: Record<string, SpritePartPose>) => void;
  resetToBindPose: () => void;
  setHighlightedPart: (partId: string | null) => void;
  /** 残影着色：tint + 整体透明度 */
  setStyle: (tint: Color3, alpha: number) => void;
  dispose: () => void;
};

const mergeTransform = (base: SpriteTransform2D, pose: SpritePartPose): SpriteTransform2D => ({
  x: pose.x ?? base.x,
  y: pose.y ?? base.y,
  rotationDeg: pose.rotationDeg ?? base.rotationDeg,
  scaleX: pose.scaleX ?? base.scaleX,
  scaleY: pose.scaleY ?? base.scaleY
});

const resolveFrameRegion = (
  atlas: TexturePackerAtlas,
  atlasJsonPath: string,
  atlasImagePath: string,
  frameName: string | undefined
): SpriteFrameRegion | null => {
  if (!frameName) return null;
  const frame = atlas.frames[frameName];
  if (!frame) return null;
  return toFrameRegion(atlasJsonPath, atlasImagePath, frameName, frame, atlas.meta.size);
};

/**
 * 创建「固定父节点 + 多精灵部件」组合体。
 * 支持部件级多图集；同一 atlas 路径共享 GPU 纹理。
 */
export const createCompositeSprite = (
  scene: Scene,
  rig: SpriteRigDef,
  atlases: AtlasBundle,
  options: CreateCompositeSpriteOptions = {}
): CompositeSprite => {
  const nameSuffix = options.nameSuffix ? `_${options.nameSuffix}` : '';
  const pickable = options.pickable !== false;
  const zBias = options.zBias ?? 0;

  const root = new TransformNode(`sprite_rig_${rig.rigId}${nameSuffix}`, scene);
  const baseSize = rig.baseSize ?? 2.5;
  const parts = new Map<string, CompositeSpritePart>();
  const meshIdToPartId = new Map<number, string>();
  let styleTint: Color3 | null = null;
  let styleAlpha = 1;

  for (const partDef of rig.parts) {
    const { atlasJsonPath, atlasImagePath } = resolvePartAtlas(rig, partDef);
    const atlas = atlases[atlasJsonPath];
    if (!atlas) {
      throw new Error(`缺少图集：${atlasJsonPath}（部件 ${partDef.partId}）`);
    }
    if (!atlasImagePath) {
      throw new Error(`缺少图集图片路径（部件 ${partDef.partId}）`);
    }

    const plane = createAtlasSpritePlane(scene, atlasImagePath, baseSize, {
      shareTexture: true
    });
    plane.mesh.name = `sprite_part_${rig.rigId}_${partDef.partId}${nameSuffix}`;
    plane.mesh.parent = root;
    plane.mesh.isPickable = pickable;
    meshIdToPartId.set(plane.mesh.uniqueId, partDef.partId);

    const bindTransform: SpriteTransform2D = {
      ...DEFAULT_SPRITE_TRANSFORM,
      ...partDef.transform
    };

    let current: Required<SpritePartPose> = {
      frameName: partDef.defaultFrameName ?? '',
      x: bindTransform.x,
      y: bindTransform.y,
      rotationDeg: bindTransform.rotationDeg,
      scaleX: bindTransform.scaleX,
      scaleY: bindTransform.scaleY,
      visible: true
    };

    const applyVisual = () => {
      const region = resolveFrameRegion(
        atlas,
        atlasJsonPath,
        atlasImagePath,
        current.frameName || undefined
      );
      plane.setFrameRegion(region);

      const frameScaleX = plane.mesh.scaling.x;
      const frameScaleY = plane.mesh.scaling.y;
      plane.mesh.position.x = current.x;
      plane.mesh.position.y = current.y;
      plane.mesh.position.z = (partDef.zIndex ?? 0) * 0.01 + zBias;
      plane.mesh.rotation.z = (current.rotationDeg * Math.PI) / 180;
      plane.mesh.scaling.x = frameScaleX * current.scaleX;
      plane.mesh.scaling.y = frameScaleY * current.scaleY;
      plane.mesh.setEnabled(current.visible);
    };

    const applyPose = (pose: SpritePartPose) => {
      const nextTransform = mergeTransform(
        {
          x: current.x,
          y: current.y,
          rotationDeg: current.rotationDeg,
          scaleX: current.scaleX,
          scaleY: current.scaleY
        },
        pose
      );
      current = {
        frameName: pose.frameName ?? current.frameName,
        x: nextTransform.x,
        y: nextTransform.y,
        rotationDeg: nextTransform.rotationDeg,
        scaleX: nextTransform.scaleX,
        scaleY: nextTransform.scaleY,
        visible: pose.visible ?? current.visible
      };
      applyVisual();
    };

    applyPose({
      frameName: partDef.defaultFrameName,
      ...bindTransform,
      visible: true
    });

    parts.set(partDef.partId, {
      partId: partDef.partId,
      def: partDef,
      atlasJsonPath,
      atlasImagePath,
      plane,
      getPose: () => ({ ...current }),
      applyPose,
      setFrameName: (frameName) => {
        applyPose({ frameName: frameName ?? '' });
      },
      setHighlighted: (highlighted) => {
        if (styleTint) return;
        const material = plane.mesh.material as StandardMaterial | null;
        if (material?.emissiveColor) {
          material.emissiveColor = highlighted
            ? new Color3(0.35, 0.7, 1)
            : Color3.White();
        }
      }
    });
  }

  const applyStyleToMaterials = () => {
    for (const part of parts.values()) {
      const material = part.plane.mesh.material as StandardMaterial | null;
      if (!material) continue;
      if (styleTint) {
        material.diffuseColor = styleTint;
        material.emissiveColor = styleTint;
        material.alpha = styleAlpha;
        // 残影需要真正的半透明混合（不能只用 AlphaTest）
        material.transparencyMode = 2;
        material.disableDepthWrite = true;
      } else {
        material.diffuseColor = Color3.White();
        material.emissiveColor = Color3.White();
        material.alpha = 1;
        material.transparencyMode = 1;
        material.disableDepthWrite = false;
      }
    }
  };

  return {
    root,
    rig,
    atlases,
    parts,
    getPart: (partId) => parts.get(partId),
    getPartByMeshUniqueId: (uniqueId) => {
      const partId = meshIdToPartId.get(uniqueId);
      return partId ? parts.get(partId) : undefined;
    },
    applyPoseMap: (poseMap) => {
      for (const [partId, pose] of Object.entries(poseMap)) {
        parts.get(partId)?.applyPose(pose);
      }
    },
    resetToBindPose: () => {
      for (const part of parts.values()) {
        const bindTransform: SpriteTransform2D = {
          ...DEFAULT_SPRITE_TRANSFORM,
          ...part.def.transform
        };
        part.applyPose({
          frameName: part.def.defaultFrameName ?? '',
          ...bindTransform,
          visible: true
        });
      }
    },
    setHighlightedPart: (partId) => {
      for (const part of parts.values()) {
        part.setHighlighted(part.partId === partId);
      }
    },
    setStyle: (tint, alpha) => {
      styleTint = tint.clone();
      styleAlpha = Math.max(0, Math.min(1, alpha));
      applyStyleToMaterials();
    },
    dispose: () => {
      for (const part of parts.values()) {
        part.plane.dispose?.();
      }
      parts.clear();
      meshIdToPartId.clear();
      root.dispose();
    }
  };
};
