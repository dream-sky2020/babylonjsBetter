export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
export const clamp = (value: number, min: number, max: number): number =>
    Math.max(min, Math.min(max, value));
export const toFixedNumber = (value: number): number => Number(value.toFixed(4));