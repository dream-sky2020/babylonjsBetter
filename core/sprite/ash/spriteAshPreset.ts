import type { SpriteAshPreset, SpriteAshPresetLibrary, SpriteDissolveFieldBlendMode, SpriteDissolveParticleMode } from './spriteAsh.types';
import { FULL_SPRITE_NOISE_ERODE_FEATURES } from '@/core/sprite/dissolve/noiseErodeFeatureFlags.ts';

export type SpriteAshParameterDefinition = {
  key: Exclude<keyof SpriteAshPreset, 'presetKey' | 'name' | 'particleMode'>;
  label: string; group: string; type: 'number' | 'color' | 'select'; min?: number; max?: number; step?: number;
  options?: { value: string; label: string }[];
};

export type SpriteAshFeatureKey = Extract<keyof SpriteAshPreset,
  'directionalFieldEnabled' | 'radialFieldEnabled' | 'crystalEnabled' | 'spiralEnabled' | 'voidEnabled' | 'domainWarpEnabled' |
  'vertexMotionEnabled' | 'vertexDeformEnabled' |
  'edgeEnabled' | 'charEnabled' | 'residueEnabled' | 'ashTrailEnabled'>;

export const SPRITE_ASH_GROUP_FEATURES: Partial<Record<string, SpriteAshFeatureKey>> = {
  '方向场': 'directionalFieldEnabled',
  '径向场': 'radialFieldEnabled',
  '冰晶结构': 'crystalEnabled',
  '旋涡结构': 'spiralEnabled',
  '虚空拉扯': 'voidEnabled',
  'Domain Warp': 'domainWarpEnabled',
  '3D 飘散': 'vertexMotionEnabled',
  '3D 顶点变形': 'vertexDeformEnabled',
  '燃烧边缘': 'edgeEnabled',
  '边缘渐染': 'edgeEnabled',
  '焦化': 'charEnabled',
  '消失后残留': 'residueEnabled',
  '灰烬尾迹': 'ashTrailEnabled'
};

export const SPRITE_ASH_PARAMETER_DEFINITIONS: SpriteAshParameterDefinition[] = [
  { key: 'duration', label: '播放时长 / 秒', group: '播放', type: 'number', min: .1, max: 30, step: .05 },
  { key: 'progressPower', label: '进度曲线指数', group: '轮廓控制', type: 'number', min: .1, max: 5, step: .05 },
  { key: 'startHold', label: '开始保持比例', group: '轮廓控制', type: 'number', min: 0, max: .9, step: .01 },
  { key: 'endFade', label: '末段整体淡出比例', group: '轮廓控制', type: 'number', min: 0, max: .5, step: .01 },
  { key: 'fieldBlendMode', label: '场混合方式', group: '轮廓控制', type: 'select', options: [
    { value: 'weighted', label: '加权平均' }, { value: 'add', label: '叠加' }, { value: 'max', label: '并集 / 最大值' },
    { value: 'min', label: '交集 / 最小值' }, { value: 'multiply', label: '相乘' }
  ] },
  { key: 'fieldInvert', label: '最终场反相', group: '轮廓控制', type: 'number', min: 0, max: 1, step: .01 },
  { key: 'fieldContrast', label: '场对比度', group: '轮廓控制', type: 'number', min: .1, max: 5, step: .05 },
  { key: 'fieldOffset', label: '场偏移', group: '轮廓控制', type: 'number', min: -1, max: 1, step: .01 },
  { key: 'directionalStrength', label: '方向场强度', group: '方向场', type: 'number', min: 0, max: 1, step: .01 },
  { key: 'directionAngleDeg', label: '消散方向角度', group: '方向场', type: 'number', min: -360, max: 360, step: 1 },
  { key: 'radialStrength', label: '径向场强度', group: '径向场', type: 'number', min: 0, max: 1, step: .01 },
  { key: 'radialDirection', label: '径向方向（-1 内向外 / 1 外向内）', group: '径向场', type: 'number', min: -1, max: 1, step: .05 },
  { key: 'centerX', label: '径向中心 X', group: '径向场', type: 'number', min: -1, max: 1, step: .01 },
  { key: 'centerY', label: '径向中心 Y', group: '径向场', type: 'number', min: -1, max: 1, step: .01 },
  { key: 'radialScaleX', label: '径向横向比例', group: '径向场', type: 'number', min: .1, max: 10, step: .05 },
  { key: 'radialScaleY', label: '径向纵向比例', group: '径向场', type: 'number', min: .1, max: 10, step: .05 },
  { key: 'radialRotationDeg', label: '径向形状旋转角度', group: '径向场', type: 'number', min: -360, max: 360, step: 1 },
  { key: 'radialPower', label: '径向曲线指数', group: '径向场', type: 'number', min: .1, max: 5, step: .05 },
  { key: 'radialNoiseStrength', label: '径向边缘噪声强度', group: '径向场', type: 'number', min: 0, max: 1, step: .01 },
  { key: 'radialNoiseScale', label: '径向边缘噪声尺度', group: '径向场', type: 'number', min: .25, max: 40, step: .05 },
  { key: 'crystalStrength', label: '冰晶结构强度', group: '冰晶结构', type: 'number', min: 0, max: 1, step: .01 },
  { key: 'crystalScale', label: '冰晶尺寸', group: '冰晶结构', type: 'number', min: .25, max: 40, step: .05 },
  { key: 'crystalSharpness', label: '冰晶锐利度', group: '冰晶结构', type: 'number', min: .01, max: 1, step: .01 },
  { key: 'crystalAspect', label: '冰晶横纵比例', group: '冰晶结构', type: 'number', min: .1, max: 10, step: .05 },
  { key: 'crystalRotationDeg', label: '冰晶旋转角度', group: '冰晶结构', type: 'number', min: -360, max: 360, step: 1 },
  { key: 'crystalCrackWidth', label: '主裂隙宽度', group: '冰晶结构', type: 'number', min: .001, max: .25, step: .001 },
  { key: 'crystalJitter', label: '晶格错位强度', group: '冰晶结构', type: 'number', min: 0, max: 1, step: .01 },
  { key: 'crystalBranchStrength', label: '分支裂隙强度', group: '冰晶结构', type: 'number', min: 0, max: 1, step: .01 },
  { key: 'crystalBranchScale', label: '分支裂隙尺度', group: '冰晶结构', type: 'number', min: .25, max: 4, step: .05 },
  { key: 'spiralStrength', label: '旋涡强度', group: '旋涡结构', type: 'number', min: 0, max: 2, step: .01 },
  { key: 'spiralTurns', label: '旋涡圈数', group: '旋涡结构', type: 'number', min: 0, max: 12, step: .1 },
  { key: 'voidPullStrength', label: '中心拉扯强度', group: '虚空拉扯', type: 'number', min: 0, max: 1, step: .01 },
  { key: 'spiralSpeed', label: '旋涡旋转速度', group: '旋涡结构', type: 'number', min: -8, max: 8, step: .05 },
  { key: 'spiralDirection', label: '旋涡方向（-1 / 1）', group: '旋涡结构', type: 'number', min: -1, max: 1, step: .05 },
  { key: 'spiralRadialFrequency', label: '旋涡径向频率', group: '旋涡结构', type: 'number', min: 0, max: 40, step: .1 },
  { key: 'voidPullRadius', label: '中心拉扯半径', group: '虚空拉扯', type: 'number', min: .05, max: 2, step: .01 },
  { key: 'voidPullFalloff', label: '中心拉扯衰减', group: '虚空拉扯', type: 'number', min: .05, max: 1, step: .01 },
  { key: 'voidPullPower', label: '拉扯进度指数', group: '虚空拉扯', type: 'number', min: .1, max: 5, step: .05 },
  { key: 'noiseScale', label: '噪声尺度', group: '溶解边界', type: 'number', min: .25, max: 80, step: .05 },
  { key: 'noiseStrength', label: '噪声扰动强度', group: '溶解边界', type: 'number', min: 0, max: 1, step: .005 },
  { key: 'noiseSpeed', label: '噪声流动速度', group: '溶解边界', type: 'number', min: -4, max: 4, step: .01 },
  { key: 'noiseDetail', label: '噪声细节层级', group: '噪声结构', type: 'number', min: 0, max: 1, step: .01 },
  { key: 'noiseRoughness', label: '噪声粗糙度', group: '噪声结构', type: 'number', min: 0, max: 1, step: .01 },
  { key: 'noiseAspect', label: '噪声长宽比', group: '噪声结构', type: 'number', min: .1, max: 10, step: .05 },
  { key: 'noiseRotationDeg', label: '噪声纹理旋转角度', group: '噪声结构', type: 'number', min: -360, max: 360, step: 1 },
  { key: 'noiseFlowAngleDeg', label: '噪声流动方向', group: '噪声结构', type: 'number', min: -360, max: 360, step: 1 },
  { key: 'warpStrength', label: 'Domain Warp 强度', group: 'Domain Warp', type: 'number', min: 0, max: 1, step: .01 },
  { key: 'warpScale', label: 'Domain Warp 尺度', group: 'Domain Warp', type: 'number', min: .25, max: 40, step: .05 },
  { key: 'warpSpeed', label: 'Domain Warp 流速', group: 'Domain Warp', type: 'number', min: -4, max: 4, step: .01 },
  { key: 'edgeWidth', label: '燃烧边宽度', group: '燃烧边缘', type: 'number', min: .001, max: .4, step: .001 },
  { key: 'edgeSoftness', label: '边缘柔化', group: '燃烧边缘', type: 'number', min: .0001, max: .2, step: .0005 },
  { key: 'edgeColor', label: '燃烧边颜色', group: '燃烧边缘', type: 'color' },
  { key: 'edgeIntensity', label: '边缘发光强度', group: '燃烧边缘', type: 'number', min: 0, max: 8, step: .05 },
  { key: 'flickerSpeed', label: '边缘闪烁速度', group: '燃烧边缘', type: 'number', min: 0, max: 40, step: .25 },
  { key: 'charColor', label: '焦化颜色', group: '焦化', type: 'color' },
  { key: 'charStrength', label: '焦化强度', group: '焦化', type: 'number', min: 0, max: 1, step: .01 },
  { key: 'ashColor', label: '灰烬颜色', group: '灰烬尾迹', type: 'color' },
  { key: 'ashTrail', label: '灰烬尾迹宽度', group: '灰烬尾迹', type: 'number', min: .001, max: .8, step: .005 },
  { key: 'ashDensity', label: '灰烬颗粒密度', group: '灰烬尾迹', type: 'number', min: 0, max: 1, step: .01 },
  { key: 'ashOpacity', label: '灰烬透明度', group: '灰烬尾迹', type: 'number', min: 0, max: 1, step: .01 },
  { key: 'rise', label: '上浮距离', group: '3D 飘散', type: 'number', min: -4, max: 8, step: .05 },
  { key: 'driftX', label: '水平漂移', group: '3D 飘散', type: 'number', min: -4, max: 4, step: .05 },
  { key: 'turbulence', label: '顶点扰动', group: '3D 飘散', type: 'number', min: 0, max: 2, step: .01 },
  { key: 'seed', label: '随机种子', group: '3D 飘散', type: 'number', min: -100, max: 100, step: .1 },
  { key: 'alphaCutoff', label: '透明裁切阈值', group: '纹理', type: 'number', min: 0, max: .5, step: .001 },
  { key: 'edgeInnerWidth', label: '边缘内层宽度比例', group: '边缘渲染', type: 'number', min: .01, max: 2, step: .01 },
  { key: 'edgeOuterWidth', label: '边缘外层宽度比例', group: '边缘渲染', type: 'number', min: .01, max: 4, step: .01 },
  { key: 'edgeInnerColor', label: '边缘内层颜色', group: '边缘渲染', type: 'color' },
  { key: 'edgeOuterColor', label: '边缘外层颜色', group: '边缘渲染', type: 'color' },
  { key: 'edgeFalloffPower', label: '边缘亮度衰减', group: '边缘渲染', type: 'number', min: .1, max: 8, step: .05 },
  { key: 'edgeNoiseStrength', label: '边缘局部扰动', group: '边缘渲染', type: 'number', min: 0, max: 1, step: .01 },
  { key: 'edgeNoiseScale', label: '边缘扰动尺度', group: '边缘渲染', type: 'number', min: .25, max: 80, step: .1 },
  { key: 'edgePulseStrength', label: '边缘脉冲强度', group: '边缘渲染', type: 'number', min: 0, max: 1, step: .01 },
  { key: 'edgePulseSpeed', label: '边缘脉冲速度', group: '边缘渲染', type: 'number', min: 0, max: 40, step: .1 },
  { key: 'residueWidth', label: '残留区域宽度', group: '消失后残留', type: 'number', min: .001, max: 1, step: .005 },
  { key: 'residueOpacity', label: '残留不透明度', group: '消失后残留', type: 'number', min: 0, max: 1, step: .01 },
  { key: 'residueColor', label: '残留颜色', group: '消失后残留', type: 'color' },
  { key: 'residueDensity', label: '残留覆盖密度', group: '消失后残留', type: 'number', min: 0, max: 1, step: .01 },
  { key: 'residueNoiseScale', label: '残留斑点尺度', group: '消失后残留', type: 'number', min: .25, max: 100, step: .1 },
  { key: 'residueDecayPower', label: '残留距离衰减', group: '消失后残留', type: 'number', min: .1, max: 8, step: .05 },
  { key: 'residueFadeStart', label: '残留末段淡出起点', group: '消失后残留', type: 'number', min: 0, max: .99, step: .01 },
  { key: 'residueGlow', label: '残留自发光强度', group: '消失后残留', type: 'number', min: 0, max: 4, step: .05 },
  { key: 'vertexDeformStrength', label: '顶点变形总强度', group: '3D 顶点变形', type: 'number', min: 0, max: 2, step: .01 },
  { key: 'vertexBendX', label: '水平弯曲', group: '3D 顶点变形', type: 'number', min: -2, max: 2, step: .01 },
  { key: 'vertexBendY', label: '垂直弯曲', group: '3D 顶点变形', type: 'number', min: -2, max: 2, step: .01 },
  { key: 'vertexTwist', label: '平面扭转', group: '3D 顶点变形', type: 'number', min: -6.3, max: 6.3, step: .05 },
  { key: 'vertexBulge', label: '中心鼓起/收缩', group: '3D 顶点变形', type: 'number', min: -2, max: 2, step: .01 },
  { key: 'vertexDepth', label: '纵深隆起', group: '3D 顶点变形', type: 'number', min: -2, max: 2, step: .01 },
  { key: 'vertexWaveStrength', label: '顶点波浪强度', group: '3D 顶点变形', type: 'number', min: 0, max: 1, step: .01 },
  { key: 'vertexWaveScale', label: '顶点波浪频率', group: '3D 顶点变形', type: 'number', min: .1, max: 40, step: .1 },
  { key: 'vertexWaveSpeed', label: '顶点波浪速度', group: '3D 顶点变形', type: 'number', min: -20, max: 20, step: .1 },
  { key: 'vertexAnchorY', label: '垂直固定线位置', group: '3D 顶点变形', type: 'number', min: 0, max: .99, step: .01 },
  { key: 'vertexSubdivisions', label: '消散网格细分', group: '3D 顶点变形', type: 'number', min: 1, max: 128, step: 1 },
  { key: 'particleRate', label: '每秒发射数量', group: '粒子系统', type: 'number', min: 0, max: 2000, step: 5 },
  { key: 'particleStartProgress', label: '粒子开始进度', group: '粒子系统', type: 'number', min: 0, max: .99, step: .01 },
  { key: 'particleEndProgress', label: '粒子结束进度', group: '粒子系统', type: 'number', min: .01, max: 1, step: .01 },
  { key: 'particleRatePower', label: '发射曲线指数', group: '粒子系统', type: 'number', min: .1, max: 8, step: .05 },
  { key: 'particleLifeMin', label: '最短粒子寿命', group: '粒子系统', type: 'number', min: .01, max: 10, step: .01 },
  { key: 'particleLifeMax', label: '最长粒子寿命', group: '粒子系统', type: 'number', min: .01, max: 10, step: .01 },
  { key: 'particlePowerMin', label: '最小初速度', group: '粒子系统', type: 'number', min: 0, max: 10, step: .05 },
  { key: 'particlePowerMax', label: '最大初速度', group: '粒子系统', type: 'number', min: 0, max: 10, step: .05 },
  { key: 'particleSizeMin', label: '最小尺寸倍率', group: '粒子系统', type: 'number', min: .01, max: 10, step: .01 },
  { key: 'particleSizeMax', label: '最大尺寸倍率', group: '粒子系统', type: 'number', min: .01, max: 10, step: .01 },
  { key: 'particleGravityX', label: '粒子重力 X', group: '粒子系统', type: 'number', min: -10, max: 10, step: .05 },
  { key: 'particleGravityY', label: '粒子重力 Y', group: '粒子系统', type: 'number', min: -10, max: 10, step: .05 },
  { key: 'particleGravityZ', label: '粒子重力 Z', group: '粒子系统', type: 'number', min: -10, max: 10, step: .05 },
  { key: 'particleAngularSpeedMin', label: '最小旋转速度', group: '粒子系统', type: 'number', min: -40, max: 40, step: .1 },
  { key: 'particleAngularSpeedMax', label: '最大旋转速度', group: '粒子系统', type: 'number', min: -40, max: 40, step: .1 }
];

export const DEFAULT_SPRITE_ASH_PRESET: SpriteAshPreset = {
  presetKey: 'ash_default', name: '默认精灵化灰', particleMode: 'ash', duration: 2.4,
  ...FULL_SPRITE_NOISE_ERODE_FEATURES,
  progressPower: 1, startHold: 0, endFade: .04, fieldBlendMode: 'weighted', fieldInvert: 0, fieldContrast: 1, fieldOffset: 0,
  directionalStrength: 1, directionAngleDeg: 90, radialStrength: 0, radialDirection: 1, centerX: 0, centerY: 0,
  radialScaleX: 1, radialScaleY: 1, radialRotationDeg: 0, radialPower: 1, radialNoiseStrength: .2, radialNoiseScale: 6,
  crystalStrength: 0, crystalScale: 8, crystalSharpness: .5, crystalAspect: 1, crystalRotationDeg: 0,
  crystalCrackWidth: .035, crystalJitter: .12, crystalBranchStrength: .35, crystalBranchScale: 1.7, spiralStrength: 0, spiralTurns: 3,
  spiralSpeed: 2.5, spiralDirection: 1, spiralRadialFrequency: 18, voidPullStrength: 0, voidPullRadius: .72, voidPullFalloff: .67, voidPullPower: 2,
  noiseScale: 7.5, noiseStrength: .3, noiseSpeed: .08, noiseDetail: .72, noiseRoughness: .5,
  noiseAspect: 1, noiseRotationDeg: 0, noiseFlowAngleDeg: 90, warpStrength: 0, warpScale: 4, warpSpeed: .05,
  edgeWidth: .055, edgeSoftness: .012,
  edgeColor: '#ff9a3d', edgeIntensity: 1.65, edgeInnerWidth: .32, edgeOuterWidth: 1,
  edgeInnerColor: '#fff1c7', edgeOuterColor: '#ff6a1a', edgeFalloffPower: 1,
  edgeNoiseStrength: .08, edgeNoiseScale: 18, edgePulseStrength: .12, edgePulseSpeed: 7,
  residueWidth: .18, residueOpacity: .22, residueColor: '#4a4038', residueDensity: .55,
  residueNoiseScale: 24, residueDecayPower: 1.4, residueFadeStart: .82, residueGlow: 0,
  vertexDeformStrength: 0, vertexBendX: 0, vertexBendY: 0, vertexTwist: 0, vertexBulge: 0,
  vertexDepth: 0, vertexWaveStrength: 0, vertexWaveScale: 8, vertexWaveSpeed: 3, vertexAnchorY: 0, vertexSubdivisions: 12,
  particleRate: 220, particleStartProgress: 0, particleEndProgress: .985, particleRatePower: 1,
  particleLifeMin: .45, particleLifeMax: 1.15, particlePowerMin: .25, particlePowerMax: .72,
  particleSizeMin: .25, particleSizeMax: .72, particleGravityX: 0, particleGravityY: .16, particleGravityZ: 0,
  particleAngularSpeedMin: -5, particleAngularSpeedMax: 5,
  charColor: '#241c18', charStrength: .72,
  ashColor: '#c8c3bb', ashTrail: .2, ashDensity: .52, ashOpacity: .72, rise: .7, driftX: .18,
  turbulence: .13, flickerSpeed: 7, seed: 3.7, alphaCutoff: .025
};

const finite = (value: unknown, fallback: number, min: number, max: number) => Math.max(min, Math.min(max, Number.isFinite(Number(value)) ? Number(value) : fallback));
const booleanValue = (value: unknown, fallback: boolean) => typeof value === 'boolean' ? value : fallback;
const color = (value: unknown, fallback: string) => typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value) ? value : fallback;
const PARTICLE_MODES: SpriteDissolveParticleMode[] = ['none', 'ash', 'blackShards', 'embers', 'pixel'];
const FIELD_BLEND_MODES: SpriteDissolveFieldBlendMode[] = ['weighted', 'add', 'max', 'min', 'multiply'];
const legacyParticleMode = (value: unknown): SpriteDissolveParticleMode => value === 'blackShards' || value === 'embers' || value === 'pixel' || value === 'ash' ? value : 'none';

export const normalizeSpriteAshPreset = (key: string, value: unknown): SpriteAshPreset => {
  const input = value && typeof value === 'object' ? value as Partial<SpriteAshPreset> & { effectMode?: unknown } : {};
  const f = DEFAULT_SPRITE_ASH_PRESET;
  const oldMode = input.effectMode;
  const legacyFrost = oldMode === 'frost', legacyVoid = oldMode === 'void';
  return {
    presetKey: key, name: typeof input.name === 'string' && input.name.trim() ? input.name : f.name,
    particleMode: PARTICLE_MODES.includes(input.particleMode as SpriteDissolveParticleMode) ? input.particleMode as SpriteDissolveParticleMode : legacyParticleMode(oldMode),
    directionalFieldEnabled: booleanValue(input.directionalFieldEnabled, true), radialFieldEnabled: booleanValue(input.radialFieldEnabled, true),
    crystalEnabled: booleanValue(input.crystalEnabled, true), spiralEnabled: booleanValue(input.spiralEnabled, true),
    voidEnabled: booleanValue(input.voidEnabled, true), domainWarpEnabled: booleanValue(input.domainWarpEnabled, true),
    vertexMotionEnabled: booleanValue(input.vertexMotionEnabled, true), vertexDeformEnabled: booleanValue(input.vertexDeformEnabled, true),
    edgeEnabled: booleanValue(input.edgeEnabled, true), charEnabled: booleanValue(input.charEnabled, true),
    residueEnabled: booleanValue(input.residueEnabled, true), ashTrailEnabled: booleanValue(input.ashTrailEnabled, true),
    duration: finite(input.duration, f.duration, .1, 30),
    progressPower: finite(input.progressPower, 1, .1, 5), startHold: finite(input.startHold, 0, 0, .9), endFade: finite(input.endFade, .04, 0, .5),
    fieldBlendMode: FIELD_BLEND_MODES.includes(input.fieldBlendMode as SpriteDissolveFieldBlendMode) ? input.fieldBlendMode as SpriteDissolveFieldBlendMode : 'weighted',
    fieldInvert: finite(input.fieldInvert, 0, 0, 1), fieldContrast: finite(input.fieldContrast, 1, .1, 5), fieldOffset: finite(input.fieldOffset, 0, -1, 1),
    directionalStrength: finite(input.directionalStrength, legacyVoid ? 0 : 1, 0, 1), directionAngleDeg: finite(input.directionAngleDeg, f.directionAngleDeg, -360, 360),
    radialStrength: finite(input.radialStrength, legacyVoid ? 1 : 0, 0, 1), radialDirection: finite(input.radialDirection, 1, -1, 1),
    centerX: finite(input.centerX, 0, -1, 1), centerY: finite(input.centerY, 0, -1, 1),
    radialScaleX: finite(input.radialScaleX, 1, .1, 10), radialScaleY: finite(input.radialScaleY, 1, .1, 10), radialRotationDeg: finite(input.radialRotationDeg, 0, -360, 360),
    radialPower: finite(input.radialPower, 1, .1, 5), radialNoiseStrength: finite(input.radialNoiseStrength, .2, 0, 1), radialNoiseScale: finite(input.radialNoiseScale, 6, .25, 40),
    crystalStrength: finite(input.crystalStrength, legacyFrost ? 1 : 0, 0, 1), crystalScale: finite(input.crystalScale, 8, .25, 40),
    crystalSharpness: finite(input.crystalSharpness, .5, .01, 1), crystalAspect: finite(input.crystalAspect, 1, .1, 10),
    crystalRotationDeg: finite(input.crystalRotationDeg, 0, -360, 360), crystalCrackWidth: finite(input.crystalCrackWidth, .035, .001, .25),
    crystalJitter: finite(input.crystalJitter, .12, 0, 1), crystalBranchStrength: finite(input.crystalBranchStrength, .35, 0, 1),
    crystalBranchScale: finite(input.crystalBranchScale, 1.7, .25, 4), spiralStrength: finite(input.spiralStrength, legacyVoid ? .75 : 0, 0, 2),
    spiralTurns: finite(input.spiralTurns, 3, 0, 12), spiralSpeed: finite(input.spiralSpeed, 2.5, -8, 8), spiralDirection: finite(input.spiralDirection, 1, -1, 1),
    spiralRadialFrequency: finite(input.spiralRadialFrequency, 18, 0, 40), voidPullStrength: finite(input.voidPullStrength, legacyVoid ? .8 : 0, 0, 1),
    voidPullRadius: finite(input.voidPullRadius, .72, .05, 2), voidPullFalloff: finite(input.voidPullFalloff, .67, .05, 1), voidPullPower: finite(input.voidPullPower, 2, .1, 5),
    noiseScale: finite(input.noiseScale, f.noiseScale, .25, 80), noiseStrength: finite(input.noiseStrength, f.noiseStrength, 0, 1), noiseSpeed: finite(input.noiseSpeed, f.noiseSpeed, -4, 4),
    noiseDetail: finite(input.noiseDetail, f.noiseDetail, 0, 1), noiseRoughness: finite(input.noiseRoughness, f.noiseRoughness, 0, 1),
    noiseAspect: finite(input.noiseAspect, 1, .1, 10), noiseRotationDeg: finite(input.noiseRotationDeg, 0, -360, 360), noiseFlowAngleDeg: finite(input.noiseFlowAngleDeg, 90, -360, 360),
    warpStrength: finite(input.warpStrength, 0, 0, 1), warpScale: finite(input.warpScale, 4, .25, 40), warpSpeed: finite(input.warpSpeed, .05, -4, 4),
    edgeWidth: finite(input.edgeWidth, f.edgeWidth, .001, .4), edgeSoftness: finite(input.edgeSoftness, f.edgeSoftness, .0001, .2), edgeColor: color(input.edgeColor, f.edgeColor), edgeIntensity: finite(input.edgeIntensity, f.edgeIntensity, 0, 8),
    edgeInnerWidth: finite(input.edgeInnerWidth, .32, .01, 2), edgeOuterWidth: finite(input.edgeOuterWidth, 1, .01, 4),
    edgeInnerColor: color(input.edgeInnerColor, '#fff1c7'), edgeOuterColor: color(input.edgeOuterColor, input.edgeColor ?? f.edgeColor),
    edgeFalloffPower: finite(input.edgeFalloffPower, 1, .1, 8), edgeNoiseStrength: finite(input.edgeNoiseStrength, .08, 0, 1), edgeNoiseScale: finite(input.edgeNoiseScale, 18, .25, 80),
    edgePulseStrength: finite(input.edgePulseStrength, .12, 0, 1), edgePulseSpeed: finite(input.edgePulseSpeed, input.flickerSpeed ?? 7, 0, 40),
    residueWidth: finite(input.residueWidth, .18, .001, 1), residueOpacity: finite(input.residueOpacity, .22, 0, 1), residueColor: color(input.residueColor, '#4a4038'),
    residueDensity: finite(input.residueDensity, .55, 0, 1), residueNoiseScale: finite(input.residueNoiseScale, 24, .25, 100), residueDecayPower: finite(input.residueDecayPower, 1.4, .1, 8),
    residueFadeStart: finite(input.residueFadeStart, .82, 0, .99), residueGlow: finite(input.residueGlow, 0, 0, 4),
    vertexDeformStrength: finite(input.vertexDeformStrength, 0, 0, 2), vertexBendX: finite(input.vertexBendX, 0, -2, 2), vertexBendY: finite(input.vertexBendY, 0, -2, 2),
    vertexTwist: finite(input.vertexTwist, 0, -6.3, 6.3), vertexBulge: finite(input.vertexBulge, 0, -2, 2), vertexDepth: finite(input.vertexDepth, 0, -2, 2),
    vertexWaveStrength: finite(input.vertexWaveStrength, 0, 0, 1), vertexWaveScale: finite(input.vertexWaveScale, 8, .1, 40), vertexWaveSpeed: finite(input.vertexWaveSpeed, 3, -20, 20),
    vertexAnchorY: finite(input.vertexAnchorY, 0, 0, .99), vertexSubdivisions: Math.round(finite(input.vertexSubdivisions, 12, 1, 128)),
    particleRate: finite(input.particleRate, 220, 0, 2000), particleStartProgress: finite(input.particleStartProgress, 0, 0, .99), particleEndProgress: finite(input.particleEndProgress, .985, .01, 1),
    particleRatePower: finite(input.particleRatePower, 1, .1, 8), particleLifeMin: finite(input.particleLifeMin, .45, .01, 10), particleLifeMax: finite(input.particleLifeMax, 1.15, .01, 10),
    particlePowerMin: finite(input.particlePowerMin, .25, 0, 10), particlePowerMax: finite(input.particlePowerMax, .72, 0, 10),
    particleSizeMin: finite(input.particleSizeMin, .25, .01, 10), particleSizeMax: finite(input.particleSizeMax, .72, .01, 10),
    particleGravityX: finite(input.particleGravityX, 0, -10, 10), particleGravityY: finite(input.particleGravityY, .16, -10, 10), particleGravityZ: finite(input.particleGravityZ, 0, -10, 10),
    particleAngularSpeedMin: finite(input.particleAngularSpeedMin, -5, -40, 40), particleAngularSpeedMax: finite(input.particleAngularSpeedMax, 5, -40, 40),
    charColor: color(input.charColor, f.charColor), charStrength: finite(input.charStrength, f.charStrength, 0, 1), ashColor: color(input.ashColor, f.ashColor), ashTrail: finite(input.ashTrail, f.ashTrail, .001, .8),
    ashDensity: finite(input.ashDensity, f.ashDensity, 0, 1), ashOpacity: finite(input.ashOpacity, f.ashOpacity, 0, 1), rise: finite(input.rise, f.rise, -4, 8), driftX: finite(input.driftX, f.driftX, -4, 4),
    turbulence: finite(input.turbulence, f.turbulence, 0, 2), flickerSpeed: finite(input.flickerSpeed, f.flickerSpeed, 0, 40), seed: finite(input.seed, f.seed, -100, 100), alphaCutoff: finite(input.alphaCutoff, f.alphaCutoff, 0, .5)
  };
};

export const normalizeSpriteAshPresetLibrary = (value: unknown): SpriteAshPresetLibrary => {
  const input = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  return Object.fromEntries(Object.entries(input).map(([key, preset]) => [key, normalizeSpriteAshPreset(key, preset)]));
};
