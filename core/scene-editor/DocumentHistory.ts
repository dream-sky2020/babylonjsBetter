/** Optional domain-owned history for adapters without an existing store. Values must be immutable. */
export class DocumentHistory<T> {
  private past: T[] = [];
  private future: T[] = [];
  private start: T | undefined;
  value: T;
  private changed: (value: T) => void;
  constructor(value: T, changed: (value: T) => void) { this.value = value; this.changed = changed; }
  set(value: T) {
    if (JSON.stringify(value) === JSON.stringify(this.value)) return;
    if (this.start === undefined) { this.past.push(this.value); this.past = this.past.slice(-100); this.future = []; }
    this.value = value; this.changed(value);
  }
  begin() { this.start ??= this.value; }
  commit() { const start = this.start; this.start = undefined; if (start !== undefined && JSON.stringify(start) !== JSON.stringify(this.value)) { this.past.push(start); this.past = this.past.slice(-100); this.future = []; } }
  cancel() { const start = this.start; this.start = undefined; if (start !== undefined) { this.value = start; this.changed(start); } }
  undo() { this.cancel(); const value = this.past.pop(); if (value === undefined) return; this.future.push(this.value); this.value = value; this.changed(value); }
  redo() { this.cancel(); const value = this.future.pop(); if (value === undefined) return; this.past.push(this.value); this.value = value; this.changed(value); }
}
