import {
  Color3,
  Effect,
  Engine,
  ShaderMaterial,
  type BaseTexture,
  type Scene
} from '@babylonjs/core';
import type { ExclamationMarkPreset } from './exclamationMark.types.ts';

const SHADER_NAME = 'exclamationMarkProgress';

Effect.ShadersStore[`${SHADER_NAME}VertexShader`] = `
precision highp float;
attribute vec3 position;
attribute vec2 uv;
uniform mat4 worldViewProjection;
varying vec2 vUV;
void main(void) {
  gl_Position = worldViewProjection * vec4(position, 1.0);
  vUV = uv;
}`;

Effect.ShadersStore[`${SHADER_NAME}FragmentShader`] = `
precision highp float;
varying vec2 vUV;
uniform sampler2D textureSampler;
uniform float fillPercent;
uniform float fillDirection;
uniform float fillUsesTexture;
uniform float backgroundUsesTexture;
uniform vec3 fillColor;
uniform vec3 backgroundColor;
uniform float fillOpacity;
uniform float backgroundOpacity;

void main(void) {
  vec4 source = texture2D(textureSampler, vUV);
  if (source.a <= 0.001) discard;

  bool filled = false;
  if (fillDirection < 0.5) filled = vUV.y <= fillPercent;
  else if (fillDirection < 1.5) filled = vUV.y >= 1.0 - fillPercent;
  else if (fillDirection < 2.5) filled = vUV.x <= fillPercent;
  else filled = vUV.x >= 1.0 - fillPercent;

  vec3 filledRgb = mix(fillColor, source.rgb, fillUsesTexture);
  vec3 backgroundRgb = mix(backgroundColor, source.rgb, backgroundUsesTexture);
  float regionOpacity = filled ? fillOpacity : backgroundOpacity;
  gl_FragColor = vec4(filled ? filledRgb : backgroundRgb, source.a * regionOpacity);
}`;

const parseColor = (value: string, fallback: string): Color3 => {
  try {
    return Color3.FromHexString(value);
  } catch {
    return Color3.FromHexString(fallback);
  }
};

const directionValue = (direction: ExclamationMarkPreset['fillDirection']): number => {
  if (direction === 'top-to-bottom') return 1;
  if (direction === 'left-to-right') return 2;
  if (direction === 'right-to-left') return 3;
  return 0;
};

export const createExclamationMarkProgressMaterial = (
  scene: Scene,
  texture: BaseTexture,
  preset: ExclamationMarkPreset
): ShaderMaterial => {
  const material = new ShaderMaterial(
    `exclamation_mark_progress_${preset.presetKey}`,
    scene,
    SHADER_NAME,
    {
      attributes: ['position', 'uv'],
      uniforms: [
        'worldViewProjection',
        'fillPercent',
        'fillDirection',
        'fillUsesTexture',
        'backgroundUsesTexture',
        'fillColor',
        'backgroundColor',
        'fillOpacity',
        'backgroundOpacity'
      ],
      samplers: ['textureSampler']
    }
  );
  material.setTexture('textureSampler', texture);
  applyExclamationMarkProgressPreset(material, preset);
  material.backFaceCulling = false;
  material.alphaMode = Engine.ALPHA_COMBINE;
  material.needAlphaBlending = () => true;
  material.disableDepthWrite = true;
  return material;
};

export const applyExclamationMarkProgressPreset = (
  material: ShaderMaterial,
  preset: ExclamationMarkPreset
): void => {
  material.setFloat('fillPercent', preset.fillPercent);
  material.setFloat('fillDirection', directionValue(preset.fillDirection));
  material.setFloat('fillUsesTexture', preset.fillMode === 'texture' ? 1 : 0);
  material.setFloat('backgroundUsesTexture', preset.backgroundMode === 'texture' ? 1 : 0);
  material.setColor3('fillColor', parseColor(preset.fillColor, '#ffd84d'));
  material.setColor3('backgroundColor', parseColor(preset.backgroundColor, '#263449'));
  material.setFloat('fillOpacity', preset.fillOpacity);
  material.setFloat('backgroundOpacity', preset.backgroundOpacity);
};
