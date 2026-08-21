import type { SpriteAshEffectMode } from '../spriteAsh.types';

export type SpriteAshShaderDefinition = {
  mode: SpriteAshEffectMode;
  shaderName: string;
  subdivisions: number;
  variant: number;
  vertexSource: string;
  fragmentSource: string;
};

export const SPRITE_ASH_UNIFORMS = [
  'worldViewProjection', 'uTime', 'uProgress', 'uRise', 'uDriftX', 'uTurbulence', 'uSeed',
  'uDirectionAngle', 'uNoiseScale', 'uNoiseStrength', 'uNoiseSpeed', 'uEdgeWidth',
  'uEdgeSoftness', 'uEdgeColor', 'uEdgeIntensity', 'uCharColor', 'uCharStrength',
  'uAshColor', 'uAshTrail', 'uAshDensity', 'uAshOpacity', 'uFlickerSpeed', 'uAlphaCutoff',
  'uVariant'
];

export const SHADER_NOISE = `
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1,311.7)) + uSeed) * 43758.5453123); }
float noise(vec2 p) {
  vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
  return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.,1.)),f.x),f.y);
}
float fbm(vec2 p) {
  float v=0., a=.5;
  for(int i=0;i<4;i++){v+=noise(p)*a;p=p*2.03+17.13;a*=.5;}
  return v;
}`;
