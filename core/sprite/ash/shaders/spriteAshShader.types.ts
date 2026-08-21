export type SpriteAshShaderDefinition = {
  shaderName: string;
  subdivisions: number;
  vertexSource: string;
  fragmentSource: string;
};

export const SPRITE_ASH_UNIFORMS = [
  'worldViewProjection', 'uTime', 'uProgress', 'uRise', 'uDriftX', 'uTurbulence', 'uSeed',
  'uDirectionAngle', 'uNoiseScale', 'uNoiseStrength', 'uNoiseSpeed', 'uEdgeWidth',
  'uEdgeSoftness', 'uEdgeColor', 'uEdgeIntensity', 'uCharColor', 'uCharStrength',
  'uEdgeInnerWidth', 'uEdgeOuterWidth', 'uEdgeInnerColor', 'uEdgeOuterColor', 'uEdgeFalloffPower',
  'uEdgeNoiseStrength', 'uEdgeNoiseScale', 'uEdgePulseStrength', 'uEdgePulseSpeed',
  'uResidueWidth', 'uResidueOpacity', 'uResidueColor', 'uResidueDensity', 'uResidueNoiseScale',
  'uResidueDecayPower', 'uResidueFadeStart', 'uResidueGlow',
  'uVertexDeformStrength', 'uVertexBendX', 'uVertexBendY', 'uVertexTwist', 'uVertexBulge',
  'uVertexDepth', 'uVertexWaveStrength', 'uVertexWaveScale', 'uVertexWaveSpeed', 'uVertexAnchorY',
  'uAshColor', 'uAshTrail', 'uAshDensity', 'uAshOpacity', 'uFlickerSpeed', 'uAlphaCutoff',
  'uDirectionalStrength', 'uRadialStrength', 'uRadialDirection', 'uCenter',
  'uRadialScale', 'uRadialRotation', 'uRadialPower', 'uRadialNoiseStrength', 'uRadialNoiseScale',
  'uCrystalStrength', 'uCrystalScale', 'uCrystalSharpness', 'uSpiralStrength',
  'uCrystalAspect', 'uCrystalRotation', 'uCrystalCrackWidth', 'uCrystalJitter', 'uCrystalBranchStrength', 'uCrystalBranchScale',
  'uSpiralTurns', 'uSpiralSpeed', 'uSpiralDirection', 'uSpiralRadialFrequency',
  'uVoidPullStrength', 'uVoidPullRadius', 'uVoidPullFalloff', 'uVoidPullPower', 'uProgressPower', 'uStartHold', 'uEndFade',
  'uFieldBlendMode', 'uFieldInvert', 'uFieldContrast', 'uFieldOffset',
  'uNoiseDetail', 'uNoiseRoughness', 'uNoiseAspect', 'uNoiseRotation', 'uNoiseFlowAngle',
  'uWarpStrength', 'uWarpScale', 'uWarpSpeed'
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
