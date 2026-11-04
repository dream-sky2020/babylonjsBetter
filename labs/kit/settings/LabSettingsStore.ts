export type SettingValue = boolean | number | string | null | SettingValue[] | { [key: string]: SettingValue };
export type RememberedSetting = { remember: boolean; value?: SettingValue };
export type SettingDefinition = {
  key: string;
  label: string;
  elements: readonly HTMLElement[];
  defaultRemember?: boolean;
  legacyKey?: string;
  read(): SettingValue;
  write(value: SettingValue): void;
  valid(value: unknown): boolean;
};

const isValue = (value: unknown): value is SettingValue => value === null || typeof value === 'boolean'
  || typeof value === 'string' || typeof value === 'number' && Number.isFinite(value)
  || !!value && typeof value === 'object' && Object.values(value).every(isValue);

/** Page-local preferences, separate from LabState snapshots and authored documents. */
export class LabSettingsStore {
  private records: Record<string, RememberedSetting> = Object.create(null);
  private storage: Pick<Storage, 'getItem' | 'setItem'> | undefined;
  private storageKey: string;
  private onError: () => void;
  constructor(storage: Pick<Storage, 'getItem' | 'setItem'> | undefined, storageKey: string,
    onError: () => void = () => {}) {
    this.storage = storage; this.storageKey = storageKey; this.onError = onError;
    try {
      const saved = JSON.parse(storage?.getItem(storageKey) ?? 'null');
      if (saved?.version === 1 && saved.items && typeof saved.items === 'object' && !Array.isArray(saved.items)) {
        for (const [key, record] of Object.entries(saved.items)) {
          const row = record as RememberedSetting;
          if (row && typeof row.remember === 'boolean') this.records[key] = {
            remember: row.remember, ...(row.remember && isValue(row.value) ? { value: row.value } : {}),
          };
        }
      }
    } catch { /* Invalid or unavailable browser storage leaves module defaults intact. */ }
  }
  get(id: string): RememberedSetting | undefined { return this.records[id] && structuredClone(this.records[id]); }
  put(id: string, record: RememberedSetting): void {
    this.records[id] = structuredClone(record);
  }
  remove(id: string): void { delete this.records[id]; }
  flush(): void {
    try {
      if (!this.storage) throw new Error('Local storage unavailable');
      this.storage.setItem(this.storageKey, JSON.stringify({ version: 1, items: this.records }));
    } catch { this.onError(); }
  }
}

export function controlSetting(key: string, label: string, control: HTMLInputElement | HTMLSelectElement,
  options: Partial<Pick<SettingDefinition, 'defaultRemember' | 'legacyKey' | 'read' | 'write' | 'valid'>> = {}): SettingDefinition {
  const checkbox = control.tagName === 'INPUT' && (control as HTMLInputElement).type === 'checkbox';
  const numeric = control.tagName === 'INPUT' && (control as HTMLInputElement).type === 'number';
  return {
    key, label, elements: [control],
    read: () => checkbox ? (control as HTMLInputElement).checked
      : numeric ? (control.value.trim() ? Number(control.value) : NaN) : control.value,
    write: value => { if (checkbox) (control as HTMLInputElement).checked = value as boolean; else control.value = String(value); },
    valid: value => {
      if (checkbox) return typeof value === 'boolean';
      const input = control as HTMLInputElement;
      if (numeric) return typeof value === 'number' && Number.isFinite(value)
        && (!input.min || value >= Number(input.min)) && (!input.max || value <= Number(input.max));
      if (typeof value !== 'string') return false;
      if (control.tagName === 'SELECT') return [...(control as HTMLSelectElement).options].some(option => option.value === value);
      return input.type === 'color' ? /^#[0-9a-f]{6}$/i.test(value)
        : ['text', 'search'].includes(input.type) && value.length <= (input.maxLength > 0 ? input.maxLength : 1000);
    },
    ...options,
  };
}
