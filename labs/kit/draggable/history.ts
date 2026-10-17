export type LayoutHistory<T> = { past: T[]; present: T; future: T[] };
export function createHistory<T>(value: T): LayoutHistory<T> { return { past: [], present: structuredClone(value), future: [] }; }
export function recordHistory<T>(history: LayoutHistory<T>, value: T, record = true): LayoutHistory<T> {
  if (JSON.stringify(history.present) === JSON.stringify(value)) return history;
  const present = structuredClone(value);
  return record ? { past: [...history.past, history.present].slice(-100), present, future: [] } : { ...history, present };
}
export function undoHistory<T>(history: LayoutHistory<T>): LayoutHistory<T> { return history.past.length ? { past: history.past.slice(0, -1), present: history.past.at(-1)!, future: [history.present, ...history.future] } : history; }
export function redoHistory<T>(history: LayoutHistory<T>): LayoutHistory<T> { return history.future.length ? { past: [...history.past, history.present].slice(-100), present: history.future[0], future: history.future.slice(1) } : history; }
