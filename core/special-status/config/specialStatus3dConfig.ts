import type { SpecialStatus3dConfig, SpecialStatus3dState, SpecialStatus3dVector } from '../types/specialStatus3d.types.ts';
import type { NumberSpritePreset } from '@/core/sprite';

const finite = (value: number, fallback: number): number => Number.isFinite(value) ? value : fallback;
const vector = (value: SpecialStatus3dVector | undefined, fallback: SpecialStatus3dVector): SpecialStatus3dVector => [
  finite(value?.[0] ?? fallback[0], fallback[0]),
  finite(value?.[1] ?? fallback[1], fallback[1]),
  finite(value?.[2] ?? fallback[2], fallback[2])
];

export const createDefaultSpecialStatus3dConfig = (
  numberPreset: NumberSpritePreset,
  iconPath = '/resources/favicon.svg'
): SpecialStatus3dConfig => ({
  iconPath,
  numberPreset,
  statusHeight: 2.4,
  statusScale: 1,
  numberScale: 1,
  cornerInset: 0,
  position: [0, 2.25, 0],
  numberOffsets: [[0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0]],
  billboard: true,
  facingAxis: '+Z'
});

export const normalizeSpecialStatus3dConfig = (config: SpecialStatus3dConfig): SpecialStatus3dConfig => ({
  ...config,
  iconPath: config.iconPath || '/resources/favicon.svg',
  statusHeight: Math.max(0.01, finite(config.statusHeight, 2.4)),
  statusScale: Math.max(0.01, finite(config.statusScale, 1)),
  numberScale: Math.max(0.01, finite(config.numberScale, 1)),
  cornerInset: finite(config.cornerInset, 0),
  position: vector(config.position, [0, 2.25, 0]),
  numberOffsets: [0, 1, 2, 3].map((index) => vector(config.numberOffsets?.[index], [0, 0, 0])) as SpecialStatus3dConfig['numberOffsets'],
  billboard: config.billboard !== false,
  facingAxis: config.facingAxis === '-Z' ? '-Z' : '+Z'
});

export const createDefaultSpecialStatus3dState = (): SpecialStatus3dState => ({
  values: [89, 42, 17, 64],
  visible: [true, true, true, true],
  debug: false,
  enabled: true
});
