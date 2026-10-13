/** Optional domain-owned history for adapters without an existing store. Values must be immutable. */
export class DocumentHistory<T> {
  private past: T[] = [];
  private future: T[] = [];
  private start: T | undefined;
  value: T;
  private changed: (value: T) => void;
  private equal: (a: T, b: T) => boolean;
  constructor(value: T, changed: (value: T) => void, equal = (a: T, b: T) => a === b || JSON.stringify(a) === JSON.stringify(b)) { this.value = value; this.changed = changed; this.equal = equal; }
  set(value: T) {
    if (this.equal(value, this.value)) return;
    if (this.start === undefined) { this.past.push(this.value); this.past = this.past.slice(-100); this.future = []; }
    this.value = value; this.changed(value);
  }
  begin() { this.start ??= this.value; }
  commit() { const start = this.start; this.start = undefined; if (start !== undefined && !this.equal(start, this.value)) { this.past.push(start); this.past = this.past.slice(-100); this.future = []; } }
  cancel() { const start = this.start; this.start = undefined; if (start !== undefined) { this.value = start; this.changed(start); } }
  undo() { this.cancel(); const value = this.past.pop(); if (value === undefined) return; this.future.push(this.value); this.value = value; this.changed(value); }
  redo() { this.cancel(); const value = this.future.pop(); if (value === undefined) return; this.past.push(this.value); this.value = value; this.changed(value); }
}
