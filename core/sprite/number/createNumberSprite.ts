import { Color3, Mesh, MeshBuilder, TransformNode, Vector3, type Scene } from '@babylonjs/core';
import { loadTexturePackerAtlas } from '@/core/sprite/atlas/normalizeTexturePackerAtlas.ts';
import { createAtlasSpritePlane } from '@/core/sprite/render/createAtlasSpritePlane.ts';
import { joinPublicPath, toFrameRegion } from '@/core/sprite/editor/spriteAnchorEditorHelpers.ts';
import type { IconPlaneController } from '@/core/sprite/types/sprite.types.ts';
import type { NumberSprite, NumberSpriteGlyphSource, NumberSpritePreset } from './numberSprite.types.ts';

const atlasCache = new Map<string, Awaited<ReturnType<typeof loadTexturePackerAtlas>>>();

const normalizePath = (path: string): string => path.replace(/^\/+/, '');

const loadAtlas = async (path: string) => {
  const key = normalizePath(path);
  let atlas = atlasCache.get(key);
  if (!atlas) {
    atlas = await loadTexturePackerAtlas(key);
    atlasCache.set(key, atlas);
  }
  return atlas;
};

const resolveGlyph = async (source: NumberSpriteGlyphSource) => {
  if (source.type === 'single') {
    return { imagePath: normalizePath(source.imagePath), region: null };
  }
  const atlas = await loadAtlas(source.atlasJsonPath);
  const frame = atlas.frames[source.frameName];
  if (!frame) throw new Error(`图集 ${source.atlasJsonPath} 中不存在帧：${source.frameName}`);
  const imagePath = joinPublicPath(source.atlasJsonPath, atlas.meta.image);
  return {
    imagePath,
    region: toFrameRegion(source.atlasJsonPath, imagePath, source.frameName, frame, atlas.meta.size)
  };
};

const waitForTexture = (controller: IconPlaneController): Promise<void> => {
  if (controller.texture.isReady()) return Promise.resolve();
  return new Promise((resolve) => controller.texture.onLoadObservable.addOnce(() => resolve()));
};

const collectIntegerGroupingBoundaries = (text: string): Set<number> => {
  const characters = [...text];
  const decimalIndex = characters.indexOf('.');
  const integerEnd = decimalIndex >= 0 ? decimalIndex : characters.length;
  const digitIndices = characters
    .map((character, index) => ({ character, index }))
    .filter(({ character, index }) => index < integerEnd && /^\d$/.test(character))
    .map(({ index }) => index);
  const boundaries = new Set<number>();
  for (let i = 0; i < digitIndices.length - 1; i += 1) {
    const remainingDigits = digitIndices.length - i - 1;
    if (remainingDigits % 3 === 0) boundaries.add(digitIndices[i]);
  }
  return boundaries;
};

export const createNumberSprite = async (
  scene: Scene,
  text: string,
  preset: NumberSpritePreset
): Promise<NumberSprite> => {
  const root = new TransformNode(`number_sprite_${preset.presetKey}`, scene);
  root.billboardMode = preset.billboard ? Mesh.BILLBOARDMODE_ALL : 0;
  let currentText = text;
  let parts: IconPlaneController[] = [];
  let debugMeshes: Mesh[] = [];
  let generation = 0;
  let debugVisible = false;

  const clearDebugMeshes = () => {
    for (const mesh of debugMeshes) mesh.dispose();
    debugMeshes = [];
  };

  const refreshDebugMeshes = () => {
    clearDebugMeshes();
    for (const part of parts) {
      part.mesh.showBoundingBox = debugVisible;
      if (!debugVisible) continue;
      const border = MeshBuilder.CreateLines(`${part.mesh.name}_debug_border`, {
        points: [
          new Vector3(-0.5, 0.5, -0.02),
          new Vector3(0.5, 0.5, -0.02),
          new Vector3(0.5, -0.5, -0.02),
          new Vector3(-0.5, -0.5, -0.02),
          new Vector3(-0.5, 0.5, -0.02)
        ]
      }, scene);
      const centerLines = MeshBuilder.CreateLineSystem(`${part.mesh.name}_debug_center_lines`, {
        lines: [
          [new Vector3(-0.5, 0, -0.02), new Vector3(0.5, 0, -0.02)],
          [new Vector3(0, -0.5, -0.02), new Vector3(0, 0.5, -0.02)]
        ]
      }, scene);
      for (const debugMesh of [border, centerLines]) {
        debugMesh.color = new Color3(1, 0.82, 0.2);
        debugMesh.parent = part.mesh;
        debugMesh.isPickable = false;
        debugMesh.renderingGroupId = 3;
        debugMeshes.push(debugMesh);
      }
    }
  };

  const clearParts = () => {
    clearDebugMeshes();
    for (const part of parts) part.dispose?.();
    parts = [];
  };

  const setText = async (nextText: string) => {
    const currentGeneration = ++generation;
    clearParts();
    currentText = nextText;
    const groupingBoundaries = preset.groupingEnabled === true
      ? collectIntegerGroupingBoundaries(nextText)
      : new Set<number>();
    const baseSpacing = Number.isFinite(preset.spacing) ? preset.spacing : 0;
    const extraGroupSpacing = Number.isFinite(preset.groupingExtraSpacing)
      ? Math.max(0, preset.groupingExtraSpacing)
      : 0;
    const created: Array<{ controller: IconPlaneController; width: number; sourceIndex: number }> = [];

    try {
      for (const [index, character] of [...nextText].entries()) {
        const source = preset.glyphs[character];
        if (!source) continue;
        const { imagePath, region } = await resolveGlyph(source);
        if (currentGeneration !== generation) {
          for (const item of created) item.controller.dispose?.();
          return;
        }
        const controller = createAtlasSpritePlane(scene, encodeURI(`/${normalizePath(imagePath)}`), preset.height, {
          shareTexture: source.type === 'atlas'
        });
        controller.mesh.name = `number_sprite_${preset.presetKey}_${index}_${character}`;
        controller.mesh.parent = root;
        controller.mesh.isPickable = false;
        controller.mesh.showBoundingBox = debugVisible;
        controller.setFrameRegion(region);
        await waitForTexture(controller);
        if (currentGeneration !== generation) {
          controller.dispose?.();
          for (const item of created) item.controller.dispose?.();
          return;
        }
        created.push({ controller, width: controller.mesh.scaling.x, sourceIndex: index });
      }
    } catch (error) {
      for (const item of created) item.controller.dispose?.();
      throw error;
    }

    parts = created.map((item) => item.controller);
    refreshDebugMeshes();
    const groupGapCount = created.slice(0, -1)
      .filter((item) => groupingBoundaries.has(item.sourceIndex)).length;
    const totalWidth = created.reduce((sum, item) => sum + item.width, 0)
      + Math.max(0, created.length - 1) * baseSpacing
      + groupGapCount * extraGroupSpacing;
    let cursor = preset.alignment === 'left' ? 0 : preset.alignment === 'right' ? -totalWidth : -totalWidth / 2;
    for (const [itemIndex, item] of created.entries()) {
      item.controller.mesh.position.x = cursor + item.width / 2;
      const groupGap = itemIndex < created.length - 1 && groupingBoundaries.has(item.sourceIndex)
        ? extraGroupSpacing
        : 0;
      cursor += item.width + baseSpacing + groupGap;
    }
  };

  const result: NumberSprite = {
    root,
    preset,
    getText: () => currentText,
    setText,
    isDebugVisible: () => debugVisible,
    setDebugVisible: (visible) => {
      debugVisible = visible;
      refreshDebugMeshes();
    },
    dispose: () => {
      generation += 1;
      clearParts();
      root.dispose();
    }
  };
  await setText(text);
  return result;
};
