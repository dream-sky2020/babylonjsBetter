import type { SpriteAshEffectMode, SpriteAshPreset, SpriteAshPresetLibrary } from './spriteAsh.types';

export type SpriteAshParameterDefinition = {
  key: Exclude<keyof SpriteAshPreset, 'presetKey' | 'name' | 'effectMode'>;
  label: string;
  group: string;
  type: 'number' | 'color';
  min?: number;
  max?: number;
  step?: number;
};

export const SPRITE_ASH_PARAMETER_DEFINITIONS: SpriteAshParameterDefinition[] = [
  { key: 'duration', label: '播放时长 / 秒', group: '播放', type: 'number', min: 0.1, max: 30, step: 0.05 },
  { key: 'directionAngleDeg', label: '消散方向角度', group: '溶解边界', type: 'number', min: -360, max: 360, step: 1 },
  { key: 'noiseScale', label: '噪声尺度', group: '溶解边界', type: 'number', min: 0.25, max: 80, step: 0.05 },
  { key: 'noiseStrength', label: '噪声扰动强度', group: '溶解边界', type: 'number', min: 0, max: 1, step: 0.005 },
  { key: 'noiseSpeed', label: '噪声流动速度', group: '溶解边界', type: 'number', min: -4, max: 4, step: 0.01 },
  { key: 'edgeWidth', label: '燃烧边宽度', group: '燃烧边缘', type: 'number', min: 0.001, max: 0.4, step: 0.001 },
  { key: 'edgeSoftness', label: '边缘柔化', group: '燃烧边缘', type: 'number', min: 0.0001, max: 0.2, step: 0.0005 },
  { key: 'edgeColor', label: '燃烧边颜色', group: '燃烧边缘', type: 'color' },
  { key: 'edgeIntensity', label: '边缘发光强度', group: '燃烧边缘', type: 'number', min: 0, max: 8, step: 0.05 },
  { key: 'flickerSpeed', label: '边缘闪烁速度', group: '燃烧边缘', type: 'number', min: 0, max: 40, step: 0.25 },
  { key: 'charColor', label: '焦化颜色', group: '焦化', type: 'color' },
  { key: 'charStrength', label: '焦化强度', group: '焦化', type: 'number', min: 0, max: 1, step: 0.01 },
  { key: 'ashColor', label: '灰烬颜色', group: '灰烬尾迹', type: 'color' },
  { key: 'ashTrail', label: '灰烬尾迹宽度', group: '灰烬尾迹', type: 'number', min: 0.001, max: 0.8, step: 0.005 },
  { key: 'ashDensity', label: '灰烬颗粒密度', group: '灰烬尾迹', type: 'number', min: 0, max: 1, step: 0.01 },
  { key: 'ashOpacity', label: '灰烬透明度', group: '灰烬尾迹', type: 'number', min: 0, max: 1, step: 0.01 },
  { key: 'rise', label: '上浮距离', group: '3D 飘散', type: 'number', min: -4, max: 8, step: 0.05 },
  { key: 'driftX', label: '水平漂移', group: '3D 飘散', type: 'number', min: -4, max: 4, step: 0.05 },
  { key: 'turbulence', label: '顶点扰动', group: '3D 飘散', type: 'number', min: 0, max: 2, step: 0.01 },
  { key: 'seed', label: '随机种子', group: '3D 飘散', type: 'number', min: -100, max: 100, step: 0.1 },
  { key: 'alphaCutoff', label: '透明裁切阈值', group: '纹理', type: 'number', min: 0, max: 0.5, step: 0.001 }
];

export const DEFAULT_SPRITE_ASH_PRESET: SpriteAshPreset = {
  presetKey: 'ash_default',
  effectMode: 'ash',
  name: '默认精灵化灰',
  duration: 2.4,
  directionAngleDeg: 90,
  noiseScale: 7.5,
  noiseStrength: 0.3,
  noiseSpeed: 0.08,
  edgeWidth: 0.055,
  edgeSoftness: 0.012,
  edgeColor: '#ff9a3d',
  edgeIntensity: 1.65,
  charColor: '#241c18',
  charStrength: 0.72,
  ashColor: '#c8c3bb',
  ashTrail: 0.2,
  ashDensity: 0.52,
  ashOpacity: 0.72,
  rise: 0.7,
  driftX: 0.18,
  turbulence: 0.13,
  flickerSpeed: 7,
  seed: 3.7,
  alphaCutoff: 0.025
};

const finite = (value: unknown, fallback: number, min: number, max: number) => {
  const number = Number(value);
  return Math.max(min, Math.min(max, Number.isFinite(number) ? number : fallback));
};
const color = (value: unknown, fallback: string) => typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value) ? value : fallback;
const EFFECT_MODES: SpriteAshEffectMode[] = ['ash', 'blackShards', 'embers', 'frost', 'pixel', 'void'];
const normalizeEffectMode = (value: unknown): SpriteAshEffectMode => EFFECT_MODES.includes(value as SpriteAshEffectMode) ? value as SpriteAshEffectMode : 'ash';

export const normalizeSpriteAshPreset = (key: string, value: unknown): SpriteAshPreset => {
  const input = value && typeof value === 'object' ? value as Partial<SpriteAshPreset> : {};
  const fallback = DEFAULT_SPRITE_ASH_PRESET;
  return {
    presetKey: key,
    effectMode: normalizeEffectMode(input.effectMode),
    name: typeof input.name === 'string' && input.name.trim() ? input.name : fallback.name,
    duration: finite(input.duration, fallback.duration, 0.1, 30),
    directionAngleDeg: finite(input.directionAngleDeg, fallback.directionAngleDeg, -360, 360),
    noiseScale: finite(input.noiseScale, fallback.noiseScale, 0.25, 80),
    noiseStrength: finite(input.noiseStrength, fallback.noiseStrength, 0, 1),
    noiseSpeed: finite(input.noiseSpeed, fallback.noiseSpeed, -4, 4),
    edgeWidth: finite(input.edgeWidth, fallback.edgeWidth, 0.001, 0.4),
    edgeSoftness: finite(input.edgeSoftness, fallback.edgeSoftness, 0.0001, 0.2),
    edgeColor: color(input.edgeColor, fallback.edgeColor),
    edgeIntensity: finite(input.edgeIntensity, fallback.edgeIntensity, 0, 8),
    charColor: color(input.charColor, fallback.charColor),
    charStrength: finite(input.charStrength, fallback.charStrength, 0, 1),
    ashColor: color(input.ashColor, fallback.ashColor),
    ashTrail: finite(input.ashTrail, fallback.ashTrail, 0.001, 0.8),
    ashDensity: finite(input.ashDensity, fallback.ashDensity, 0, 1),
    ashOpacity: finite(input.ashOpacity, fallback.ashOpacity, 0, 1),
    rise: finite(input.rise, fallback.rise, -4, 8),
    driftX: finite(input.driftX, fallback.driftX, -4, 4),
    turbulence: finite(input.turbulence, fallback.turbulence, 0, 2),
    flickerSpeed: finite(input.flickerSpeed, fallback.flickerSpeed, 0, 40),
    seed: finite(input.seed, fallback.seed, -100, 100),
    alphaCutoff: finite(input.alphaCutoff, fallback.alphaCutoff, 0, 0.5)
  };
};

export const normalizeSpriteAshPresetLibrary = (value: unknown): SpriteAshPresetLibrary => {
  const input = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  return Object.fromEntries(Object.entries(input).map(([key, preset]) => [key, normalizeSpriteAshPreset(key, preset)]));
};
