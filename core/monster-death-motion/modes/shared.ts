import { Vector3 } from '@babylonjs/core';
import type { MonsterDeathParameterValues, MonsterDeathSample } from '../types';

export const number = (parameters: MonsterDeathParameterValues, key: string, fallback: number) => {
  const value = Number(parameters[key]);
  return Number.isFinite(value) ? value : fallback;
};
export const text = (parameters: MonsterDeathParameterValues, key: string, fallback: string) =>
  typeof parameters[key] === 'string' ? String(parameters[key]) : fallback;
export const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
export const smooth = (value: number) => { const p = clamp01(value); return p * p * (3 - 2 * p); };
export const easeOut = (value: number) => 1 - Math.pow(1 - clamp01(value), 3);
export const fadeAfter = (progress: number, start: number) => 1 - smooth((progress - start) / Math.max(0.001, 1 - start));
export const sample = (patch: Partial<MonsterDeathSample> = {}): MonsterDeathSample => ({
  visualOffset: new Vector3(),
  rotationX: 0,
  rotationY: 0,
  rotationZ: 0,
  scaleX: 1,
  scaleY: 1,
  scaleZ: 1,
  opacity: 1,
  overlayColor: '#ffffff',
  overlayStrength: 0,
  ...patch
});
