import { Mesh, Scene, ShaderMaterial, Texture, VertexData } from '@babylonjs/core';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { createSpriteNoiseErodeOptions } from '@/core/sprite/dissolve/createSpriteNoiseErodeOptions.ts';
import { createProfiledSpriteVisualSurface } from '@/core/sprite/render/createProfiledSpriteVisualSurface.ts';
import { createSpriteDissolveParticles } from './createSpriteDissolveParticles';
import { DEFAULT_SPRITE_ASH_PRESET, normalizeSpriteAshPreset } from './spriteAshPreset';
import type { SpriteAshPreset } from './spriteAsh.types';
import { resolveAppAssetUrl } from '@/core/resources/appAssetUrl.ts';

const applyContinuousSpriteGeometry = (mesh: Mesh, columns = 12, rows = columns) => {
  const positions: number[] = [], uvs: number[] = [], indices: number[] = [];
  for (let y = 0; y <= rows; y++) for (let x = 0; x <= columns; x++) {
    const u = x / columns, v = y / rows;
    positions.push(u - .5, v - .5, 0);
    uvs.push(u, v);
  }
  const stride = columns + 1;
  for (let y = 0; y < rows; y++) for (let x = 0; x < columns; x++) {
    const a = y * stride + x, b = a + 1, d = a + stride, c = d + 1;
    indices.push(a, b, c, a, c, d);
  }
  const data = new VertexData();
  data.positions = positions; data.uvs = uvs; data.indices = indices; data.applyToMesh(mesh, true);
};

const createContinuousSpriteMesh = (scene: Scene, subdivisions = 12) => {
  const mesh = new Mesh('spriteAshPlane', scene);
  applyContinuousSpriteGeometry(mesh, subdivisions);
  return mesh;
};

export type SpriteAshEffectController = {
  mesh: Mesh;
  material: ShaderMaterial;
  texture: Texture;
  preset: SpriteAshPreset;
  setPreset: (preset: SpriteAshPreset) => void;
  setProgress: (progress: number) => void;
  updateTime: (timeSeconds: number) => void;
  setDisplayScale: (scale: number) => void;
  dispose: () => void;
};

export const createSpriteAshEffect = (
  scene: Scene,
  texturePath: string,
  presetInput: SpriteAshPreset = DEFAULT_SPRITE_ASH_PRESET
): SpriteAshEffectController => {
  let preset = normalizeSpriteAshPreset(presetInput.presetKey, presetInput);
  const mesh = createContinuousSpriteMesh(scene, preset.vertexSubdivisions);

  const texture = new Texture(resolveAppAssetUrl(texturePath), scene, false, true, Texture.TRILINEAR_SAMPLINGMODE);
  texture.hasAlpha = true;
  texture.wrapU = Texture.CLAMP_ADDRESSMODE;
  texture.wrapV = Texture.CLAMP_ADDRESSMODE;

  let progress = 0;
  let time = 0;
  let displayScale = 5;
  let meshSubdivisions = preset.vertexSubdivisions;

  const surface = createProfiledSpriteVisualSurface(scene, {
    role: 'effect-preview',
    name: 'spriteAshMaterial',
    sourceTexture: texture,
    baseMaterial: new StandardMaterial('spriteAshFallbackMaterial', scene),
    renderSizePx: { width: 512, height: 512 },
    effects: { dissolve: createSpriteNoiseErodeOptions(preset, progress) }
  });
  const material = surface.material as ShaderMaterial;
  mesh.material = material;
  const particles = createSpriteDissolveParticles(scene, mesh, preset);

  const applyScale = () => {
    const size = texture.getSize();
    const aspect = Math.max(0.05, size.width / Math.max(1, size.height));
    mesh.scaling.set(displayScale * aspect, displayScale, 1);
  };
  texture.onLoadObservable.add(() => {
    const size = texture.getSize();
    surface.setRenderSize(size.width, size.height);
    applyScale();
  });
  applyScale();

  const controller: SpriteAshEffectController = {
    mesh, material, texture, preset,
    setPreset: (nextInput) => {
      const nextPreset = normalizeSpriteAshPreset(nextInput.presetKey, nextInput);
      preset = nextPreset;
      controller.preset = preset;
      if (preset.vertexSubdivisions !== meshSubdivisions) {
        meshSubdivisions = preset.vertexSubdivisions;
        applyContinuousSpriteGeometry(mesh, meshSubdivisions);
      }
      particles.setPreset(preset);
      surface.setEffects({ dissolve: createSpriteNoiseErodeOptions(preset, progress) });
    },
    setProgress: (next) => {
      progress = Math.max(0, Math.min(1, Number(next) || 0));
      surface.setEffects({ dissolve: createSpriteNoiseErodeOptions(preset, progress) });
      particles.setProgress(progress);
    },
    updateTime: (next) => {
      time = Number.isFinite(next) ? next : 0;
      surface.setTime(time);
      particles.updateTime(time);
    },
    setDisplayScale: (next) => {
      displayScale = Math.max(0.1, Number(next) || 1);
      applyScale();
      particles.setDisplayScale(displayScale);
    },
    dispose: () => { particles.dispose(); surface.dispose(); texture.dispose(); mesh.dispose(); }
  };
  return controller;
};
