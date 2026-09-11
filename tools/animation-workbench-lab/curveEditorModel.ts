import type { NumberCurveKey } from '@/core/animation/signal';

export type CurveKeySelection = Readonly<{ curveId: string; keyId: string }>;
export type CurveClipboardKey = Readonly<{ curveId: string; key: NumberCurveKey }>;
export type CurveView = Readonly<{ timeMin: number; timeMax: number; valueMin: number; valueMax: number }>;
export type CurveScreenPoint = CurveKeySelection & Readonly<{ x: number; y: number }>;
export type CurveScreenRect = Readonly<{ left: number; top: number; right: number; bottom: number }>;

export const curveSelectionId = (selection: CurveKeySelection) => `${selection.curveId}:${selection.keyId}`;

export const snapCurveValue = (value: number, step: number | null) => step && step > 0 ? Number((Math.round(value / step) * step).toPrecision(12)) : value;
export const snapCurveTime = (time: number, framesPerSecond: number | null) => framesPerSecond && framesPerSecond > 0 ? Math.round(time * framesPerSecond) / framesPerSecond : time;

export const moveCurveKeys = (
  curves: ReadonlyMap<string, readonly NumberCurveKey[]>,
  selection: readonly CurveKeySelection[],
  deltaTime: number,
  deltaValue: number,
  duration: number,
  framesPerSecond: number | null,
  valueStep: number | null,
) => {
  const selected = new Set(selection.map(curveSelectionId));
  return new Map([...curves].map(([curveId, keys]) => [curveId, keys.map(key => selected.has(curveSelectionId({ curveId, keyId: key.id })) ? {
    ...key,
    time: Math.min(duration, Math.max(0, snapCurveTime(key.time + deltaTime, framesPerSecond))),
    value: snapCurveValue(key.value + deltaValue, valueStep),
  } : key).sort((left, right) => left.time - right.time)]));
};

export const selectCurveKeysInRect = (points: readonly CurveScreenPoint[], rect: CurveScreenRect) =>
  points.filter(point => point.x >= rect.left && point.x <= rect.right && point.y >= rect.top && point.y <= rect.bottom)
    .map(({ curveId, keyId }) => ({ curveId, keyId }));

export const pasteCurveKeys = (
  curves: ReadonlyMap<string, readonly NumberCurveKey[]>,
  clipboard: readonly CurveClipboardKey[],
  pasteTime: number,
  duration: number,
  makeId: () => string,
) => {
  if (!clipboard.length) return { curves: new Map(curves), selection: [] as CurveKeySelection[] };
  const firstTime = Math.min(...clipboard.map(item => item.key.time));
  const additions = new Map<string, NumberCurveKey[]>();
  const selection: CurveKeySelection[] = [];
  clipboard.forEach(item => {
    if (!curves.has(item.curveId)) return;
    const key = { ...item.key, id: makeId(), time: Math.min(duration, Math.max(0, pasteTime + item.key.time - firstTime)) };
    const keys = additions.get(item.curveId) ?? []; keys.push(key); additions.set(item.curveId, keys);
    selection.push({ curveId: item.curveId, keyId: key.id });
  });
  return { curves: new Map([...curves].map(([curveId, keys]) => [curveId, [...keys, ...(additions.get(curveId) ?? [])].sort((left, right) => left.time - right.time)])), selection };
};

const zoomRange = (min: number, max: number, anchor: number, factor: number, minimumSpan: number) => {
  const span = Math.max(minimumSpan, (max - min) * factor);
  const ratio = (anchor - min) / Math.max(1e-6, max - min);
  return [anchor - span * ratio, anchor + span * (1 - ratio)] as const;
};

export const zoomCurveView = (view: CurveView, axis: 'time' | 'value', anchor: number, factor: number, duration: number): CurveView => {
  if (axis === 'value') {
    const [valueMin, valueMax] = zoomRange(view.valueMin, view.valueMax, anchor, factor, .0001);
    return { ...view, valueMin, valueMax };
  }
  const [rawMin, rawMax] = zoomRange(view.timeMin, view.timeMax, anchor, factor, .01);
  const span = Math.min(duration, rawMax - rawMin);
  const timeMin = Math.min(Math.max(0, rawMin), Math.max(0, duration - span));
  return { ...view, timeMin, timeMax: timeMin + span };
};

export const panCurveView = (view: CurveView, deltaTime: number, deltaValue: number, duration: number): CurveView => {
  const timeSpan = view.timeMax - view.timeMin;
  const timeMin = Math.min(Math.max(0, view.timeMin + deltaTime), Math.max(0, duration - timeSpan));
  return { ...view, timeMin, timeMax: timeMin + timeSpan, valueMin: view.valueMin + deltaValue, valueMax: view.valueMax + deltaValue };
};
