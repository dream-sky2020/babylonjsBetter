import { Color3, Effect, Engine, Mesh, Scene, ShaderMaterial, Texture, VertexData } from '@babylonjs/core';
import { createSpriteDissolveParticles } from './createSpriteDissolveParticles';
import { getSpriteAshShader, SPRITE_ASH_UNIFORMS } from './shaders';
import { DEFAULT_SPRITE_ASH_PRESET, normalizeSpriteAshPreset } from './spriteAshPreset';
import type { SpriteAshPreset } from './spriteAsh.types';

const registerShader = (preset: SpriteAshPreset) => {
  const shader = getSpriteAshShader(preset.effectMode);
  Effect.ShadersStore[`${shader.shaderName}VertexShader`] = shader.vertexSource;
  Effect.ShadersStore[`${shader.shaderName}PixelShader`] = shader.fragmentSource;
  return shader;
};

const createContinuousSpriteMesh = (scene: Scene, columns = 72, rows = 72) => {
  const mesh = new Mesh('spriteAshPlane', scene);
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
  data.positions = positions; data.uvs = uvs; data.indices = indices; data.applyToMesh(mesh);
  return mesh;
};

const applyPresetUniforms = (material: ShaderMaterial, preset: SpriteAshPreset) => {
  material.setFloat('uVariant', getSpriteAshShader(preset.effectMode).variant);
  material.setFloat('uDirectionAngle', preset.directionAngleDeg * Math.PI / 180);
  material.setFloat('uNoiseScale', preset.noiseScale);
  material.setFloat('uNoiseStrength', preset.noiseStrength);
  material.setFloat('uNoiseSpeed', preset.noiseSpeed);
  material.setFloat('uEdgeWidth', preset.edgeWidth);
  material.setFloat('uEdgeSoftness', preset.edgeSoftness);
  material.setColor3('uEdgeColor', Color3.FromHexString(preset.edgeColor));
  material.setFloat('uEdgeIntensity', preset.edgeIntensity);
  material.setColor3('uCharColor', Color3.FromHexString(preset.charColor));
  material.setFloat('uCharStrength', preset.charStrength);
  material.setColor3('uAshColor', Color3.FromHexString(preset.ashColor));
  material.setFloat('uAshTrail', preset.ashTrail);
  material.setFloat('uAshDensity', preset.ashDensity);
  material.setFloat('uAshOpacity', preset.ashOpacity);
  material.setFloat('uRise', preset.rise);
  material.setFloat('uDriftX', preset.driftX);
  material.setFloat('uTurbulence', preset.turbulence);
  material.setFloat('uFlickerSpeed', preset.flickerSpeed);
  material.setFloat('uSeed', preset.seed);
  material.setFloat('uAlphaCutoff', preset.alphaCutoff);
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
  const mesh = createContinuousSpriteMesh(scene);

  const texture = new Texture(texturePath, scene, false, true, Texture.TRILINEAR_SAMPLINGMODE);
  texture.hasAlpha = true;
  texture.wrapU = Texture.CLAMP_ADDRESSMODE;
  texture.wrapV = Texture.CLAMP_ADDRESSMODE;

  let progress = 0;
  let time = 0;
  let displayScale = 5;

  const makeMaterial = (nextPreset: SpriteAshPreset) => {
    const shader = registerShader(nextPreset);
    const next = new ShaderMaterial(`spriteAshMaterial_${shader.mode}`, scene, {
      vertex: shader.shaderName,
      fragment: shader.shaderName
    }, {
      attributes: ['position', 'uv'],
      uniforms: SPRITE_ASH_UNIFORMS,
      samplers: ['uTexture'],
      needAlphaBlending: true,
      needAlphaTesting: true
    });
    next.backFaceCulling = false;
    next.alphaMode = Engine.ALPHA_COMBINE;
    next.setTexture('uTexture', texture);
    applyPresetUniforms(next, nextPreset);
    next.setFloat('uProgress', progress);
    next.setFloat('uTime', time);
    return next;
  };

  let material = makeMaterial(preset);
  mesh.material = material;
  const particles = createSpriteDissolveParticles(scene, mesh, preset);

  const applyScale = () => {
    const size = texture.getSize();
    const aspect = Math.max(0.05, size.width / Math.max(1, size.height));
    mesh.scaling.set(displayScale * aspect, displayScale, 1);
  };
  texture.onLoadObservable.add(applyScale);
  applyScale();

  const controller: SpriteAshEffectController = {
    mesh, material, texture, preset,
    setPreset: (nextInput) => {
      const nextPreset = normalizeSpriteAshPreset(nextInput.presetKey, nextInput);
      const modeChanged = nextPreset.effectMode !== preset.effectMode;
      preset = nextPreset;
      controller.preset = preset;
      particles.setPreset(preset);
      if (modeChanged) {
        const previous = material;
        material = makeMaterial(preset);
        mesh.material = material;
        controller.material = material;
        previous.dispose();
      } else {
        applyPresetUniforms(material, preset);
      }
    },
    setProgress: (next) => {
      progress = Math.max(0, Math.min(1, Number(next) || 0));
      material.setFloat('uProgress', progress);
      particles.setProgress(progress);
    },
    updateTime: (next) => {
      time = Number.isFinite(next) ? next : 0;
      material.setFloat('uTime', time);
      particles.updateTime(time);
    },
    setDisplayScale: (next) => {
      displayScale = Math.max(0.1, Number(next) || 1);
      applyScale();
      particles.setDisplayScale(displayScale);
    },
    dispose: () => { particles.dispose(); material.dispose(); texture.dispose(); mesh.dispose(); }
  };
  return controller;
};
