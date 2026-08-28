import type {
  DirectionalShadowFrustumConfig,
  ShadowFilterConfig,
  ShadowQualityOverrides,
  ShadowQualityPresetLibrary,
  ShadowQualityReference,
  ShadowQualitySettings,
  ShadowQualityTier,
} from './shadowQualityPreset.types';

const defined = <T extends object>(value: T): Partial<T> => Object.fromEntries(
  Object.entries(value).filter(([, fieldValue]) => fieldValue !== undefined),
) as Partial<T>;

export const resolveShadowQuality = (
  reference: ShadowQualityReference,
  library: ShadowQualityPresetLibrary,
  runtimeTier?: ShadowQualityTier,
): ShadowQualitySettings => {
  const preset = library[reference.qualityPresetKey];
  if (!preset) throw new Error(`找不到阴影质量预设：${reference.qualityPresetKey}`);
  const tier = runtimeTier ?? reference.qualityTier ?? preset.defaultTier;
  const base = preset.tiers[tier];
  if (!base) throw new Error(`阴影质量预设 ${preset.presetKey} 不包含档位 ${tier}`);
  const overrides = reference.overrides;
  if (!overrides) return base;
  const topLevelOverrides = defined(overrides) as ShadowQualityOverrides;
  delete topLevelOverrides.filter;
  delete topLevelOverrides.directionalFrustum;
  const resolved: ShadowQualitySettings = {
    ...base,
    ...topLevelOverrides,
    generator: overrides.generator ?? base.generator,
    filter: overrides.filter
      ? { ...(base.filter ?? { mode: 'none' }), ...defined(overrides.filter) } as ShadowFilterConfig
      : base.filter,
    directionalFrustum: overrides.directionalFrustum
      ? { ...base.directionalFrustum, ...defined(overrides.directionalFrustum) } as DirectionalShadowFrustumConfig
      : base.directionalFrustum,
  };
  if (resolved.generator.type === 'cascaded' && resolved.generator.depthClamp && resolved.filter?.mode === 'pcss') {
    throw new Error(`阴影质量预设 ${preset.presetKey} 合并后同时启用了 CSM depthClamp 与 PCSS`);
  }
  return resolved;
};
