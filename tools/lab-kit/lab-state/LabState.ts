import type {
  LabStateInspection,
  LabStateJsonValue,
  LabStateListener,
  LabStateReferenceOptions,
  LabStateRegistration,
  LabStateSnapshot,
  LabStateSnapshotEntry,
} from './labState.types';

type AnyOptions = LabStateReferenceOptions<unknown, LabStateJsonValue>;
type Entry = {
  readonly id: string;
  readonly options: AnyOptions;
  current: unknown;
};

const requireName = (label: string, value: string): string => {
  const normalized = value.trim();
  if (!normalized) throw new Error(`${label} 不能为空。`);
  return normalized;
};

const isPlainObject = (value: unknown): value is Record<string, unknown> => {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
};

export const isLabStateJsonValue = (value: unknown): value is LabStateJsonValue => {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return true;
  if (typeof value === 'number') return Number.isFinite(value);
  if (Array.isArray(value)) return value.every(isLabStateJsonValue);
  return isPlainObject(value) && Object.values(value).every(isLabStateJsonValue);
};

const cloneJson = <T extends LabStateJsonValue>(value: T): T => structuredClone(value);

const requireJson = <T extends LabStateJsonValue>(value: T, label: string): T => {
  if (!isLabStateJsonValue(value)) throw new TypeError(`${label} 必须是可序列化 JSON 数据。`);
  return value;
};

const parseSnapshot = (value: unknown): LabStateSnapshot => {
  if (!isPlainObject(value) || value.format !== 'lab-state' || value.version !== 1
    || typeof value.createdAt !== 'string' || !isPlainObject(value.modules)) {
    throw new Error('LabState Snapshot 格式或版本无效。');
  }
  Object.entries(value.modules).forEach(([moduleId, entries]) => {
    requireName('Snapshot Module ID', moduleId);
    if (!isPlainObject(entries)) throw new Error(`LabState Snapshot 模块“${moduleId}”的数据无效。`);
    Object.entries(entries).forEach(([key, entry]) => {
      if (!isPlainObject(entry) || !Number.isSafeInteger(entry.version) || (entry.version as number) < 1
        || !isLabStateJsonValue(entry.data)) {
        throw new Error(`LabState Snapshot 条目“${moduleId}/${key}”无效。`);
      }
    });
  });
  return value as LabStateSnapshot;
};

export class LabState {
  private disposed = false;
  private readonly entries = new Map<string, Entry>();
  private readonly listeners = new Set<LabStateListener>();

  registerReference<TLive, TSaved extends LabStateJsonValue = never>(
    options: LabStateReferenceOptions<TLive, TSaved>,
  ): LabStateRegistration<TLive> {
    this.requireActive();
    const moduleId = requireName('LabState Module ID', options.moduleId);
    const key = requireName('LabState Key', options.key);
    if (!Number.isSafeInteger(options.version) || options.version < 1) {
      throw new RangeError('LabState 数据版本必须是大于等于 1 的安全整数。');
    }
    const id = `${moduleId}/${key}`;
    if (this.entries.has(id)) throw new Error(`LabState 引用“${id}”已经注册。`);
    const normalized = Object.freeze({ ...options, moduleId, key }) as unknown as AnyOptions;
    const entry: Entry = { id, options: normalized, current: options.value };
    this.entries.set(id, entry);
    this.emit();
    let registered = true;
    const requireRegistered = () => {
      this.requireActive();
      if (!registered || this.entries.get(id) !== entry) throw new Error(`LabState 引用“${id}”已经注销。`);
    };
    return Object.freeze({
      moduleId,
      key,
      get current() {
        requireRegistered();
        return entry.current as TLive;
      },
      replace: (next: TLive) => {
        requireRegistered();
        entry.current = next;
        this.emit();
        return next;
      },
      markChanged: () => {
        requireRegistered();
        this.emit();
      },
      unregister: () => {
        if (!registered) return;
        registered = false;
        this.entries.delete(id);
        this.emit();
      },
    });
  }

  inspect(): readonly LabStateInspection[] {
    this.requireActive();
    return [...this.entries.values()].map((entry) => ({
      moduleId: entry.options.moduleId,
      key: entry.options.key,
      version: entry.options.version,
      persistent: !!entry.options.save,
      value: cloneJson(requireJson(entry.options.inspect(entry.current), `LabState Debug“${entry.id}”`)),
    })).sort((left, right) => (
      left.moduleId.localeCompare(right.moduleId) || left.key.localeCompare(right.key)
    ));
  }

  createSnapshot(): LabStateSnapshot {
    this.requireActive();
    const modules: Record<string, Record<string, LabStateSnapshotEntry>> = {};
    this.entries.forEach((entry) => {
      const save = entry.options.save;
      if (!save) return;
      const data = cloneJson(requireJson(save.serialize(entry.current), `LabState 存档“${entry.id}”`));
      (modules[entry.options.moduleId] ??= {})[entry.options.key] = {
        version: entry.options.version,
        data,
      };
    });
    return {
      format: 'lab-state',
      version: 1,
      createdAt: new Date().toISOString(),
      modules,
    };
  }

  async restore(snapshotValue: unknown): Promise<void> {
    this.requireActive();
    const snapshot = parseSnapshot(snapshotValue);
    const prepared: Array<{ entry: Entry; data: LabStateJsonValue }> = [];
    Object.entries(snapshot.modules).forEach(([moduleId, entries]) => {
      Object.entries(entries).forEach(([key, saved]) => {
        const id = `${moduleId}/${key}`;
        const entry = this.entries.get(id);
        if (!entry) throw new Error(`存档中的 LabState 引用“${id}”尚未注册。`);
        const save = entry.options.save;
        if (!save) throw new Error(`LabState 引用“${id}”不允许读取存档。`);
        const data = save.validate(cloneJson(saved.data), saved.version);
        prepared.push({ entry, data: cloneJson(requireJson(data, `LabState 恢复“${id}”`)) });
      });
    });
    prepared.forEach(({ entry, data }) => {
      entry.options.save!.restore(entry.current, data);
    });
    for (const { entry } of prepared) {
      await entry.options.save!.afterRestore?.(entry.current);
    }
    this.emit();
  }

  subscribe(listener: LabStateListener): () => void {
    this.requireActive();
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  dispose(): void {
    if (this.disposed) return;
    this.entries.clear();
    this.listeners.clear();
    this.disposed = true;
  }

  private emit(): void {
    this.listeners.forEach((listener) => listener());
  }

  private requireActive(): void {
    if (this.disposed) throw new Error('LabState 已释放。');
  }
}

export const createLabState = (): LabState => new LabState();
