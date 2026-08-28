export type ShadowQualityTier = 'low' | 'medium' | 'high' | 'ultra';

export type ShadowFilterConfig = {
  mode: 'none' | 'poisson' | 'exponential' | 'blur-exponential' | 'close-exponential' | 'blur-close-exponential' | 'pcf' | 'pcss';
  quality?: 'low' | 'medium' | 'high';
  blurKernel?: number;
  blurScale?: number;
  blurBoxOffset?: number;
  useKernelBlur?: boolean;
  contactHardeningLightSize?: number;
};

export type DirectionalShadowFrustumConfig = {
  size?: number;
  autoUpdateExtents?: boolean;
  autoCalcZBounds?: boolean;
  minZ?: number;
  maxZ?: number;
};

export type ShadowGeneratorConfig =
  | { type: 'standard' }
  | {
      type: 'cascaded';
      cascadeCount?: number;
      shadowMaxDistance?: number;
      lambda?: number;
      blendPercentage?: number;
      stabilizeCascades?: boolean;
      depthClamp?: boolean;
      autoCalcDepthBounds?: boolean;
      autoCalcDepthBoundsRefreshRate?: number;
      freezeShadowCastersBoundingInfo?: boolean;
      debug?: boolean;
    };

export type ShadowQualitySettings = {
  enabled: boolean;
  generator: ShadowGeneratorConfig;
  mapSize?: number;
  bias?: number;
  normalBias?: number;
  darkness?: number;
  forceBackFacesOnly?: boolean;
  frustumEdgeFalloff?: number;
  depthScale?: number;
  filter?: ShadowFilterConfig;
  directionalFrustum?: DirectionalShadowFrustumConfig;
};

export type ShadowQualityOverrides = Omit<Partial<ShadowQualitySettings>, 'generator' | 'filter' | 'directionalFrustum'> & {
  generator?: ShadowGeneratorConfig;
  filter?: Partial<ShadowFilterConfig>;
  directionalFrustum?: DirectionalShadowFrustumConfig;
};

export type ShadowQualityReference = {
  qualityPresetKey: string;
  qualityTier?: ShadowQualityTier;
  overrides?: ShadowQualityOverrides;
};

export type ShadowQualityPreset = {
  presetKey: string;
  name: string;
  defaultTier: ShadowQualityTier;
  tiers: Partial<Record<ShadowQualityTier, ShadowQualitySettings>>;
};

export type ShadowQualityPresetLibrary = Record<string, ShadowQualityPreset>;

