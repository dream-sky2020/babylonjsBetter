export type NumberCurveInterpolation = 'constant' | 'linear' | 'smooth' | 'bezier';
export type NumberCurveTangentMode = 'auto' | 'free' | 'broken';

export type NumberCurveKey = Readonly<{
  id: string;
  time: number;
  value: number;
  interpolation?: NumberCurveInterpolation;
  tangentMode?: NumberCurveTangentMode;
  inTangent?: number;
  outTangent?: number;
}>;

const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);

export const readNumberCurveKeys = (value: unknown): NumberCurveKey[] => {
  if (!Array.isArray(value)) return [];
  return value.flatMap((raw, index) => {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return [];
    const key = raw as Record<string, unknown>;
    if (!finite(key.time) || !finite(key.value)) return [];
    const interpolation = ['constant', 'linear', 'smooth', 'bezier'].includes(String(key.interpolation))
      ? key.interpolation as NumberCurveInterpolation : undefined;
    const tangentMode = ['auto', 'free', 'broken'].includes(String(key.tangentMode))
      ? key.tangentMode as NumberCurveTangentMode : undefined;
    return [{
      id: typeof key.id === 'string' ? key.id : `key-${index}`,
      time: key.time,
      value: key.value,
      ...(interpolation ? { interpolation } : {}),
      ...(tangentMode ? { tangentMode } : {}),
      ...(finite(key.inTangent) ? { inTangent: key.inTangent } : {}),
      ...(finite(key.outTangent) ? { outTangent: key.outTangent } : {}),
    }];
  }).sort((left, right) => left.time - right.time);
};

export const automaticNumberCurveTangent = (keys: readonly NumberCurveKey[], index: number) => {
  const key = keys[index];
  const left = keys[Math.max(0, index - 1)];
  const right = keys[Math.min(keys.length - 1, index + 1)];
  const span = right.time - left.time;
  if (!key || !left || !right || Math.abs(span) < 1e-6) return 0;
  return (right.value - left.value) / span;
};

export const sampleNumberCurve = (
  keysInput: readonly NumberCurveKey[],
  time: number,
  fallbackInterpolation: NumberCurveInterpolation | 'smoothstep' = 'linear',
) => {
  const keys = [...keysInput].sort((left, right) => left.time - right.time);
  if (!keys.length) return 0;
  if (time <= keys[0].time) return keys[0].value;
  const last = keys[keys.length - 1];
  if (time >= last.time) return last.value;
  const rightIndex = keys.findIndex(key => key.time >= time);
  const leftIndex = rightIndex - 1;
  const left = keys[leftIndex];
  const right = keys[rightIndex];
  const duration = Math.max(1e-6, right.time - left.time);
  const amount = (time - left.time) / duration;
  const interpolation = left.interpolation ?? (fallbackInterpolation === 'smoothstep' ? 'smooth' : fallbackInterpolation);
  if (interpolation === 'constant') return left.value;
  if (interpolation === 'linear') return left.value + (right.value - left.value) * amount;
  if (interpolation === 'smooth') {
    const smoothAmount = amount * amount * (3 - 2 * amount);
    return left.value + (right.value - left.value) * smoothAmount;
  }
  const leftSlope = left.tangentMode === 'auto' || !finite(left.outTangent)
    ? automaticNumberCurveTangent(keys, leftIndex) : left.outTangent;
  const rightSlope = right.tangentMode === 'auto' || !finite(right.inTangent)
    ? automaticNumberCurveTangent(keys, rightIndex) : right.inTangent;
  const squared = amount * amount;
  const cubed = squared * amount;
  return (2 * cubed - 3 * squared + 1) * left.value
    + (cubed - 2 * squared + amount) * leftSlope * duration
    + (-2 * cubed + 3 * squared) * right.value
    + (cubed - squared) * rightSlope * duration;
};
