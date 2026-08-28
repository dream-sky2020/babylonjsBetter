import type {
  DirectionalShadowFrustumConfig,
  ShadowFilterConfig,
  ShadowGeneratorConfig,
  ShadowQualityOverrides,
  ShadowQualityPreset,
  ShadowQualityPresetLibrary,
  ShadowQualityReference,
  ShadowQualitySettings,
  ShadowQualityTier,
} from './shadowQualityPreset.types';

const TIERS: readonly ShadowQualityTier[] = ['low', 'medium', 'high', 'ultra'];
const FILTER_MODES: readonly ShadowFilterConfig['mode'][] = ['none', 'poisson', 'exponential', 'blur-exponential', 'close-exponential', 'blur-close-exponential', 'pcf', 'pcss'];

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const string = (value: unknown, path: string): string => {
  if (typeof value !== 'string' || value.trim() === '') throw new Error(`${path} 必须是非空字符串`);
  return value;
};
const finite = (value: unknown, path: string): number => {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error(`${path} 必须是有限数字`);
  return value;
};
const optionalNumber = (value: unknown, path: string, minimum?: number): number | undefined => {
  if (value === undefined) return undefined;
  const result = finite(value, path);
  if (minimum !== undefined && result < minimum) throw new Error(`${path} 必须大于或等于 ${minimum}`);
  return result;
};
const optionalBoolean = (value: unknown, path: string): boolean | undefined => {
  if (value === undefined) return undefined;
  if (typeof value !== 'boolean') throw new Error(`${path} 必须是布尔值`);
  return value;
};
const ratio = (value: unknown, path: string): number | undefined => {
  const result = optionalNumber(value, path, 0);
  if (result !== undefined && result > 1) throw new Error(`${path} 必须在 0 到 1 之间`);
  return result;
};

const parseFilter = (value: unknown, path: string, partial = false): Partial<ShadowFilterConfig> | undefined => {
  if (value === undefined) return undefined;
  if (!isRecord(value)) throw new Error(`${path} 必须是对象`);
  if (!partial && !FILTER_MODES.includes(value.mode as ShadowFilterConfig['mode'])) throw new Error(`${path}.mode 无效`);
  if (value.mode !== undefined && !FILTER_MODES.includes(value.mode as ShadowFilterConfig['mode'])) throw new Error(`${path}.mode 无效`);
  if (value.quality !== undefined && !['low', 'medium', 'high'].includes(String(value.quality))) throw new Error(`${path}.quality 无效`);
  return {
    mode: value.mode as ShadowFilterConfig['mode'] | undefined,
    quality: value.quality as ShadowFilterConfig['quality'],
    blurKernel: optionalNumber(value.blurKernel, `${path}.blurKernel`, Number.EPSILON),
    blurScale: optionalNumber(value.blurScale, `${path}.blurScale`, Number.EPSILON),
    blurBoxOffset: optionalNumber(value.blurBoxOffset, `${path}.blurBoxOffset`, 0),
    useKernelBlur: optionalBoolean(value.useKernelBlur, `${path}.useKernelBlur`),
    contactHardeningLightSize: optionalNumber(value.contactHardeningLightSize, `${path}.contactHardeningLightSize`, 0),
  };
};

const parseFrustum = (value: unknown, path: string): DirectionalShadowFrustumConfig | undefined => {
  if (value === undefined) return undefined;
  if (!isRecord(value)) throw new Error(`${path} 必须是对象`);
  const minZ = optionalNumber(value.minZ, `${path}.minZ`);
  const maxZ = optionalNumber(value.maxZ, `${path}.maxZ`);
  if (minZ !== undefined && maxZ !== undefined && maxZ <= minZ) throw new Error(`${path}.maxZ 必须大于 minZ`);
  return {
    size: optionalNumber(value.size, `${path}.size`, Number.EPSILON),
    autoUpdateExtents: optionalBoolean(value.autoUpdateExtents, `${path}.autoUpdateExtents`),
    autoCalcZBounds: optionalBoolean(value.autoCalcZBounds, `${path}.autoCalcZBounds`),
    minZ,
    maxZ,
  };
};

const parseGenerator = (value: unknown, path: string): ShadowGeneratorConfig => {
  if (!isRecord(value)) throw new Error(`${path} 必须是对象`);
  if (value.type === 'standard') return { type: 'standard' };
  if (value.type !== 'cascaded') throw new Error(`${path}.type 只允许 standard 或 cascaded`);
  const cascadeCount = optionalNumber(value.cascadeCount, `${path}.cascadeCount`, 2);
  if (cascadeCount !== undefined && (!Number.isInteger(cascadeCount) || cascadeCount > 4)) throw new Error(`${path}.cascadeCount 必须是 2 到 4 的整数`);
  const refreshRate = optionalNumber(value.autoCalcDepthBoundsRefreshRate, `${path}.autoCalcDepthBoundsRefreshRate`, 0);
  if (refreshRate !== undefined && !Number.isInteger(refreshRate)) throw new Error(`${path}.autoCalcDepthBoundsRefreshRate 必须是非负整数`);
  return {
    type: 'cascaded',
    cascadeCount,
    shadowMaxDistance: optionalNumber(value.shadowMaxDistance, `${path}.shadowMaxDistance`, Number.EPSILON),
    lambda: ratio(value.lambda, `${path}.lambda`),
    blendPercentage: ratio(value.blendPercentage, `${path}.blendPercentage`),
    stabilizeCascades: optionalBoolean(value.stabilizeCascades, `${path}.stabilizeCascades`),
    depthClamp: optionalBoolean(value.depthClamp, `${path}.depthClamp`),
    autoCalcDepthBounds: optionalBoolean(value.autoCalcDepthBounds, `${path}.autoCalcDepthBounds`),
    autoCalcDepthBoundsRefreshRate: refreshRate,
    freezeShadowCastersBoundingInfo: optionalBoolean(value.freezeShadowCastersBoundingInfo, `${path}.freezeShadowCastersBoundingInfo`),
    debug: optionalBoolean(value.debug, `${path}.debug`),
  };
};

const parseSettingsFields = (value: Record<string, unknown>, path: string) => {
  const mapSize = optionalNumber(value.mapSize, `${path}.mapSize`, 1);
  if (mapSize !== undefined && !Number.isInteger(mapSize)) throw new Error(`${path}.mapSize 必须是正整数`);
  const darkness = ratio(value.darkness, `${path}.darkness`);
  return {
    mapSize,
    bias: optionalNumber(value.bias, `${path}.bias`, 0),
    normalBias: optionalNumber(value.normalBias, `${path}.normalBias`, 0),
    darkness,
    forceBackFacesOnly: optionalBoolean(value.forceBackFacesOnly, `${path}.forceBackFacesOnly`),
    frustumEdgeFalloff: ratio(value.frustumEdgeFalloff, `${path}.frustumEdgeFalloff`),
    depthScale: optionalNumber(value.depthScale, `${path}.depthScale`, Number.EPSILON),
    directionalFrustum: parseFrustum(value.directionalFrustum, `${path}.directionalFrustum`),
  };
};

export const parseShadowQualitySettings = (value: unknown, path: string): ShadowQualitySettings => {
  if (!isRecord(value)) throw new Error(`${path} 必须是对象`);
  if (typeof value.enabled !== 'boolean') throw new Error(`${path}.enabled 必须是布尔值`);
  const generator = parseGenerator(value.generator, `${path}.generator`);
  const filter = parseFilter(value.filter, `${path}.filter`) as ShadowFilterConfig | undefined;
  if (generator.type === 'cascaded' && generator.depthClamp && filter?.mode === 'pcss') throw new Error(`${path} 的 cascaded.depthClamp 与 PCSS 不兼容`);
  return { enabled: value.enabled, generator, ...parseSettingsFields(value, path), filter };
};

export const parseShadowQualityOverrides = (value: unknown, path: string): ShadowQualityOverrides | undefined => {
  if (value === undefined) return undefined;
  if (!isRecord(value)) throw new Error(`${path} 必须是对象`);
  return {
    enabled: optionalBoolean(value.enabled, `${path}.enabled`),
    generator: value.generator === undefined ? undefined : parseGenerator(value.generator, `${path}.generator`),
    ...parseSettingsFields(value, path),
    filter: parseFilter(value.filter, `${path}.filter`, true),
  };
};

export const parseShadowQualityReference = (value: unknown, path: string): ShadowQualityReference | undefined => {
  if (value === undefined) return undefined;
  if (!isRecord(value)) throw new Error(`${path} 必须是对象`);
  if (value.qualityTier !== undefined && !TIERS.includes(value.qualityTier as ShadowQualityTier)) throw new Error(`${path}.qualityTier 无效`);
  return {
    qualityPresetKey: string(value.qualityPresetKey, `${path}.qualityPresetKey`),
    qualityTier: value.qualityTier as ShadowQualityTier | undefined,
    overrides: parseShadowQualityOverrides(value.overrides, `${path}.overrides`),
  };
};

const parsePreset = (value: unknown, key: string): ShadowQualityPreset => {
  const path = `阴影质量预设 ${key}`;
  if (!isRecord(value) || !isRecord(value.tiers)) throw new Error(`${path}.tiers 必须是对象`);
  const presetKey = string(value.presetKey, `${path}.presetKey`);
  if (presetKey !== key) throw new Error(`${path}.presetKey 必须与配置键一致`);
  if (!TIERS.includes(value.defaultTier as ShadowQualityTier)) throw new Error(`${path}.defaultTier 无效`);
  const tiers = Object.fromEntries(Object.entries(value.tiers).map(([tier, settings]) => {
    if (!TIERS.includes(tier as ShadowQualityTier)) throw new Error(`${path}.tiers.${tier} 不是有效档位`);
    return [tier, parseShadowQualitySettings(settings, `${path}.tiers.${tier}`)];
  })) as ShadowQualityPreset['tiers'];
  if (!tiers[value.defaultTier as ShadowQualityTier]) throw new Error(`${path} 缺少默认档位 ${String(value.defaultTier)}`);
  return { presetKey, name: string(value.name, `${path}.name`), defaultTier: value.defaultTier as ShadowQualityTier, tiers };
};

export const parseShadowQualityPresetLibrary = (value: unknown): ShadowQualityPresetLibrary => {
  if (!isRecord(value)) throw new Error('阴影质量预设配置根节点必须是对象');
  return Object.fromEntries(Object.entries(value).map(([key, preset]) => [key, parsePreset(preset, key)]));
};

