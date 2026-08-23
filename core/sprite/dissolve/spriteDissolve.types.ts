import type { SpriteNoiseErodeFeatureFlags } from './noiseErodeFeatureFlags.ts';

/**
 * 稳定的精灵消散效果状态。这里描述视觉意图，不包含 uniform 或 Shader Recipe 信息。
 */
export type SpriteDissolveEffectState = SpriteNoiseErodeFeatureFlags & {
  enabled?: boolean; progress?: number; directionalStrength?: number; directionAngleDeg?: number;
  progressPower?: number; startHold?: number; endFade?: number;
  fieldBlendMode?: 'weighted' | 'add' | 'max' | 'min' | 'multiply'; fieldInvert?: number; fieldContrast?: number; fieldOffset?: number;
  radialStrength?: number; radialDirection?: number; centerX?: number; centerY?: number;
  radialScaleX?: number; radialScaleY?: number; radialRotationDeg?: number; radialPower?: number; radialNoiseStrength?: number; radialNoiseScale?: number;
  crystalStrength?: number; crystalScale?: number; crystalSharpness?: number; crystalAspect?: number; crystalRotationDeg?: number;
  crystalCrackWidth?: number; crystalJitter?: number; crystalBranchStrength?: number; crystalBranchScale?: number;
  spiralStrength?: number; spiralTurns?: number; spiralSpeed?: number; spiralDirection?: number; spiralRadialFrequency?: number;
  voidPullStrength?: number; voidPullRadius?: number; voidPullFalloff?: number; voidPullPower?: number;
  noiseScale?: number; noiseStrength?: number; noiseSpeed?: number;
  noiseDetail?: number; noiseRoughness?: number; noiseAspect?: number; noiseRotationDeg?: number; noiseFlowAngleDeg?: number;
  warpStrength?: number; warpScale?: number; warpSpeed?: number;
  edgeWidth?: number; edgeSoftness?: number; edgeColor?: string; edgeIntensity?: number;
  edgeInnerWidth?: number; edgeOuterWidth?: number; edgeInnerColor?: string; edgeOuterColor?: string; edgeFalloffPower?: number;
  edgeNoiseStrength?: number; edgeNoiseScale?: number; edgePulseStrength?: number; edgePulseSpeed?: number;
  residueWidth?: number; residueOpacity?: number; residueColor?: string; residueDensity?: number; residueNoiseScale?: number;
  residueDecayPower?: number; residueFadeStart?: number; residueGlow?: number;
  vertexDeformStrength?: number; vertexBendX?: number; vertexBendY?: number; vertexTwist?: number; vertexBulge?: number;
  vertexDepth?: number; vertexWaveStrength?: number; vertexWaveScale?: number; vertexWaveSpeed?: number; vertexAnchorY?: number;
  vertexSubdivisions?: number;
  rise?: number; driftX?: number; turbulence?: number;
  ashColor?: string; ashTrail?: number; ashDensity?: number; ashOpacity?: number;
  flickerSpeed?: number; alphaCutoff?: number;
  charColor?: string; charStrength?: number; seed?: number;
};

/** @deprecated 兼容旧调用；新代码使用 SpriteDissolveEffectState。 */
export type SpriteNoiseErodeOptions = SpriteDissolveEffectState;
