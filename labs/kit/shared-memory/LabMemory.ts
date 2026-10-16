/** A runtime schema is declared once and imported by every applicant. */
export type LabMemoryType<T> = Readonly<{
  id: string;
  version: number;
  validate(value: unknown): value is T;
}>;

export type LabSharedDataDefinition<T> = Readonly<{
  key: string;
  label: string;
  type: LabMemoryType<T>;
  create(): NoInfer<T>;
  /** Small debug projection; never traverse a Babylon scene implicitly. */
  inspect(value: NoInfer<T>): unknown;
}>;

export type LabSharedData<T> = Readonly<{
  key: string;
  current: T;
  require(): NonNullable<T>;
  /** Replacement is validated; the shared handle itself remains stable. */
  replace(value: T): T;
  /** Debug notification only. Does not broadcast or execute business behavior. */
  markChanged(): void;
}>;

export type LabMemoryScope = {
  acquire<T>(definition: LabSharedDataDefinition<T>): LabSharedData<T>;
};

export type LabMemoryInspection = Readonly<{
  key: string;
  label: string;
  typeId: string;
  version: number;
  createdBy: string;
  modules: readonly string[];
  revision: number;
}>;

type Entry = {
  definition: LabSharedDataDefinition<unknown>;
  handle: LabSharedData<unknown>;
  value: unknown;
  createdBy: string;
  modules: Set<string>;
  revision: number;
};

const name = (value: string, label: string): string => {
  if (!value.trim()) throw new Error(`${label} 不能为空。`);
  return value.trim();
};

export const defineLabMemoryType = <T>(
  id: string,
  validate: (value: unknown) => value is T,
  version = 1,
): LabMemoryType<T> => {
  if (!Number.isSafeInteger(version) || version < 1) throw new RangeError('共享数据类型版本必须是正整数。');
  return Object.freeze({ id: name(id, '共享数据类型'), version, validate });
};

export const defineLabSharedData = <T>(definition: LabSharedDataDefinition<T>): LabSharedDataDefinition<T> => (
  Object.freeze({ ...definition, key: name(definition.key, '共享数据 key') })
);

/** Per-host shared references. No ownership, dependency or read/write authorization checks. */
export class LabMemoryRegistry {
  private readonly entries = new Map<string, Entry>();
  private readonly listeners = new Set<() => void>();
  private disposed = false;

  scope(moduleId: string): LabMemoryScope {
    const id = name(moduleId, '共享数据申请模块');
    return Object.freeze({ acquire: <T>(definition: LabSharedDataDefinition<T>) => this.acquire(id, definition) });
  }

  private acquire<T>(moduleId: string, definition: LabSharedDataDefinition<T>): LabSharedData<T> {
    this.requireActive();
    const key = name(definition.key, '共享数据 key');
    let entry = this.entries.get(key);
    if (entry) {
      // Schema identity prevents unrelated structural types from masquerading under the same name.
      if (entry.definition.type !== definition.type) {
        const existing = entry.definition.type;
        const requested = definition.type;
        throw new TypeError(`模块“${moduleId}”申请共享数据“${key}”类型不匹配：已有 ${existing.id}@${existing.version}（创建模块 ${entry.createdBy}），申请 ${requested.id}@${requested.version}。类型定义必须使用同一份导出。`);
      }
      if (!entry.modules.has(moduleId)) { entry.modules.add(moduleId); this.changed(); }
      return entry.handle as LabSharedData<T>;
    }
    const value = definition.create();
    if (!definition.type.validate(value)) throw new TypeError(`模块“${moduleId}”创建共享数据“${key}”失败：初始值不符合 ${definition.type.id}@${definition.type.version}。`);
    const registry = this;
    entry = {
      definition: definition as LabSharedDataDefinition<unknown>,
      value, createdBy: moduleId, modules: new Set([moduleId]), revision: 0,
      handle: undefined as unknown as LabSharedData<unknown>,
    };
    const stored = entry;
    stored.handle = Object.freeze({
      key,
      get current() { return stored.value; },
      require() {
        if (stored.value === null || stored.value === undefined) throw new Error(`共享数据“${key}”尚未准备完成。`);
        return stored.value as NonNullable<unknown>;
      },
      replace(next: unknown) {
        registry.requireActive();
        if (!definition.type.validate(next)) throw new TypeError(`共享数据“${key}”替换失败：值不符合 ${definition.type.id}@${definition.type.version}。`);
        stored.value = next;
        stored.revision += 1;
        registry.changed();
        return next;
      },
      markChanged() { registry.requireActive(); stored.revision += 1; registry.changed(); },
    });
    this.entries.set(key, stored);
    this.changed();
    return stored.handle as LabSharedData<T>;
  }

  /** Metadata only: graph rendering does not serialize every live object. */
  inspect(): readonly LabMemoryInspection[] {
    return [...this.entries].map(([key, entry]) => ({
      key, label: entry.definition.label, typeId: entry.definition.type.id,
      version: entry.definition.type.version, createdBy: entry.createdBy,
      modules: [...entry.modules], revision: entry.revision,
    }));
  }

  inspectValue(key: string): unknown {
    this.requireActive();
    const entry = this.entries.get(key);
    if (!entry) throw new Error(`共享数据“${key}”不存在。`);
    return entry.definition.inspect(entry.value);
  }

  removeModule(moduleId: string): void {
    let changed = false;
    for (const entry of this.entries.values()) changed = entry.modules.delete(moduleId) || changed;
    if (changed) this.changed();
  }

  subscribe(listener: () => void): () => void {
    this.requireActive();
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  }

  dispose(): void { this.disposed = true; this.entries.clear(); this.listeners.clear(); }

  private requireActive(): void {
    if (this.disposed) throw new Error('Lab 共享内存已释放。');
  }

  private changed(): void {
    for (const listener of this.listeners) {
      try { listener(); } catch (error) { console.error('共享内存观察面板失败。', error); }
    }
  }
}
