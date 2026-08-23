export type SpriteNoiseErodeFeatureFlags = {
  directionalFieldEnabled: boolean;
  radialFieldEnabled: boolean;
  crystalEnabled: boolean;
  spiralEnabled: boolean;
  voidEnabled: boolean;
  domainWarpEnabled: boolean;
  vertexMotionEnabled: boolean;
  vertexDeformEnabled: boolean;
  edgeEnabled: boolean;
  charEnabled: boolean;
  residueEnabled: boolean;
  ashTrailEnabled: boolean;
};

export const FULL_SPRITE_NOISE_ERODE_FEATURES: SpriteNoiseErodeFeatureFlags = {
  directionalFieldEnabled: true,
  radialFieldEnabled: true,
  crystalEnabled: true,
  spiralEnabled: true,
  voidEnabled: true,
  domainWarpEnabled: true,
  vertexMotionEnabled: true,
  vertexDeformEnabled: true,
  edgeEnabled: true,
  charEnabled: true,
  residueEnabled: true,
  ashTrailEnabled: true
};

export const LOW_PERFORMANCE_SPRITE_NOISE_ERODE_FEATURES: SpriteNoiseErodeFeatureFlags = {
  directionalFieldEnabled: true,
  radialFieldEnabled: true,
  crystalEnabled: false,
  spiralEnabled: false,
  voidEnabled: false,
  domainWarpEnabled: false,
  vertexMotionEnabled: false,
  vertexDeformEnabled: false,
  edgeEnabled: true,
  charEnabled: false,
  residueEnabled: false,
  ashTrailEnabled: false
};
