import type { LabConfig, ConfigValues, ConfigField } from './LabConfig';
import type { LabSettingsStore, SettingDefinition } from '../settings/LabSettingsStore';

/** Transitional adapter for existing modules. New runtime modules register their own fields. */
export class LabConfigBinding {
  private active = false;
  private applying = false;
  private readonly cleanup: (() => void)[] = [];
  private unsubscribe = () => {};
  private previous = '';
  private config: LabConfig;
  private id: string;
  private definitions: readonly SettingDefinition[];
  private apply: () => void;
  constructor(config: LabConfig, id: string, definitions: readonly SettingDefinition[], apply: () => void) {
    this.config = config; this.id = id; this.definitions = definitions; this.apply = apply;
    if (new Set(definitions.map(item => item.key)).size !== definitions.length) throw new Error(`重复的配置字段：${id}`);
    for (const item of definitions) for (const element of item.elements) {
      element.dataset.labSetting = item.key;
      const edit = () => this.captureValue(item.key);
      element.addEventListener('input', edit, true); element.addEventListener('change', edit, true);
      this.cleanup.push(() => { element.removeEventListener('input', edit, true); element.removeEventListener('change', edit, true); delete element.dataset.labSetting; });
    }
  }
  restore(): void {
    if (this.active) return;
    if (!this.config.has(this.id)) {
      const fields: Record<string, ConfigField> = {};
      for (const item of this.definitions) {
        const value = item.read();
        const available = item.valid(value);
        fields[item.key] = { defaultValue: available ? value : null,
          valid: next => item.valid(next) || !available && next === null };
      }
      this.config.register(this.id, fields);
    }
    this.active = true;
    this.write();
    this.unsubscribe = this.config.subscribe(change => {
      if (change !== 'values') return;
      const next = JSON.stringify(this.config.read(this.id));
      if (!this.applying && next !== this.previous) this.write();
      this.previous = next;
    });
  }
  private write(): void {
    this.applying = true;
    try {
      const values = this.config.read(this.id);
      this.previous = JSON.stringify(values);
      for (const item of this.definitions) if (item.valid(values[item.key])) item.write(structuredClone(values[item.key]));
      this.apply();
    } finally { this.applying = false; }
  }
  captureValue(key: string): void {
    if (!this.active || this.applying) return;
    const item = this.definitions.find(field => field.key === key);
    if (!item) return;
    const value = item.read();
    if (!item.valid(value)) return;
    this.applying = true;
    try { this.config.update(this.id, { [key]: value }); }
    finally { this.applying = false; }
    this.write();
  }
  captureAll(strict = false): void {
    if (!this.active) return;
    const patch: ConfigValues = {};
    for (const item of this.definitions) {
      const value = item.read();
      if (item.valid(value)) patch[item.key] = value;
      else if (strict) throw new Error(`请先修正参数：${this.id} / ${item.label}`);
    }
    this.applying = true;
    try { this.config.update(this.id, patch); }
    finally { this.applying = false; }
  }
  validateControls(): void {
    for (const item of this.definitions) {
      if (!item.valid(item.read())) throw new Error(`请先修正参数：${this.id} / ${item.label}`);
    }
  }
  importLegacy(store: LabSettingsStore, switches: Record<string, boolean>): number {
    const patch: ConfigValues = {};
    for (const item of this.definitions) {
      const record = store.get(`${this.id}/${item.key}`);
      const value = record ? record.remember ? record.value : undefined
        : item.legacyKey && item.defaultRemember ? switches[item.legacyKey] : undefined;
      if (value !== undefined && item.valid(value)) patch[item.key] = value;
    }
    this.config.update(this.id, patch);
    return Object.keys(patch).length;
  }
  dispose(): void { this.unsubscribe(); this.cleanup.forEach(dispose => dispose()); }
}
