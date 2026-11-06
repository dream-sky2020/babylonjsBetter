export type ConfigValue = null | boolean | number | string | ConfigValue[] | { [key: string]: ConfigValue };
export type ConfigValues = Record<string, ConfigValue>;
export type LabConfigDocument = {
  format: 'lab-config';
  version: 1;
  labId: string;
  modules: Record<string, ConfigValues>;
};
export type ConfigField = { defaultValue: ConfigValue; valid(value: unknown): boolean };
export type LabConfigChange = 'values' | 'status';
const safeKey = (key: string) => /^[a-zA-Z0-9][a-zA-Z0-9_.:-]{0,127}$/.test(key)
  && !['__proto__', 'constructor', 'prototype'].includes(key);
export function validateLabId(id: string): string {
  if (!/^[a-z0-9][a-z0-9-]{0,95}$/.test(id)) throw new Error(`无效的 Lab ID：${id}`);
  return id;
}
function isJson(value: unknown, depth = 0): value is ConfigValue {
  if (depth > 20) return false;
  if (value === null || typeof value === 'boolean' || typeof value === 'string') return true;
  if (typeof value === 'number') return Number.isFinite(value);
  if (Array.isArray(value)) return value.every(item => isJson(item, depth + 1));
  return !!value && typeof value === 'object' && Object.entries(value).every(([key, item]) => safeKey(key) && isJson(item, depth + 1));
}
export function parseLabConfig(raw: unknown, labId: string): LabConfigDocument {
  validateLabId(labId);
  const doc = raw as LabConfigDocument;
  if (!doc || doc.format !== 'lab-config' || doc.version !== 1 || doc.labId !== labId
    || !doc.modules || typeof doc.modules !== 'object' || Array.isArray(doc.modules)) throw new Error(`Lab ${labId} 的配置格式、版本或 ID 不匹配。`);
  for (const [id, values] of Object.entries(doc.modules)) {
    if (!safeKey(id) || !values || typeof values !== 'object' || Array.isArray(values) || !isJson(values)) throw new Error(`Lab 配置模块无效：${id}`);
  }
  return structuredClone(doc);
}

/** Runtime-owned configuration. No panel, browser storage or network dependency. */
export class LabConfig {
  private document: LabConfigDocument;
  private readonly groups = new Map<string, { fields: Record<string, ConfigField>; values: ConfigValues }>();
  private readonly listeners = new Set<(change: LabConfigChange) => void>();
  private baseline: string;
  constructor(document: LabConfigDocument) {
    this.document = parseLabConfig(document, document.labId);
    this.baseline = this.signature();
  }
  get labId(): string { return this.document.labId; }
  has(id: string): boolean { return this.groups.has(id); }
  register(id: string, fields: Record<string, ConfigField>): ConfigValues {
    if (!safeKey(id) || this.groups.has(id)) throw new Error(`配置组无效或重复：${id}`);
    const values: ConfigValues = {};
    for (const [key, field] of Object.entries(fields)) {
      if (!safeKey(key) || !isJson(field.defaultValue) || !field.valid(field.defaultValue)) throw new Error(`配置默认值无效：${id}.${key}`);
      const value = Object.hasOwn(this.document.modules[id] ?? {}, key) ? this.document.modules[id][key] : field.defaultValue;
      if (!field.valid(value)) throw new Error(`配置参数无效：${id}.${key}`);
      values[key] = structuredClone(value);
    }
    this.groups.set(id, { fields, values });
    return values;
  }
  read(id: string): ConfigValues {
    const group = this.groups.get(id);
    if (!group) throw new Error(`配置组未注册：${id}`);
    return structuredClone(group.values);
  }
  update(id: string, patch: ConfigValues): void {
    const group = this.groups.get(id);
    if (!group) throw new Error(`配置组未注册：${id}`);
    for (const [key, value] of Object.entries(patch)) {
      if (!Object.hasOwn(group.fields, key) || !isJson(value) || !group.fields[key].valid(value)) throw new Error(`配置参数无效：${id}.${key}`);
    }
    if (Object.entries(patch).every(([key, value]) => JSON.stringify(group.values[key]) === JSON.stringify(value))) return;
    Object.assign(group.values, structuredClone(patch));
    this.listeners.forEach(listener => listener('values'));
  }
  snapshot(): LabConfigDocument {
    const modules = structuredClone(this.document.modules);
    for (const [id, group] of this.groups) modules[id] = { ...modules[id], ...structuredClone(group.values) };
    return { format: 'lab-config', version: 1, labId: this.labId, modules };
  }
  private signature(): string {
    // Missing default fields and JSON key order do not make a freshly opened Lab dirty.
    const modules = structuredClone(this.document.modules);
    for (const [id, group] of this.groups) {
      modules[id] = { ...modules[id], ...group.values };
    }
    const canonical = (value: ConfigValue): unknown => Array.isArray(value) ? value.map(canonical)
      : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])])) : value;
    return JSON.stringify(canonical(modules));
  }
  get dirty(): boolean { return this.signature() !== this.baseline; }
  /** Call once after registration/legacy binding, before editing starts. */
  acceptInitial(): void { this.baseline = this.signature(); this.listeners.forEach(listener => listener('status')); }
  markSaved(saved: LabConfigDocument): void {
    // Edits made while the request was pending must remain dirty.
    this.document = parseLabConfig(saved, this.labId);
    const snapshot = new LabConfig(saved);
    this.baseline = snapshot.signature();
    this.listeners.forEach(listener => listener('status'));
  }
  subscribe(listener: (change: LabConfigChange) => void): () => void { this.listeners.add(listener); return () => this.listeners.delete(listener); }
}
