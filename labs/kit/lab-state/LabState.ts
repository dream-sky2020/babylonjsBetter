import type {
  LabCheckpoint,
  LabCheckpointOperation,
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
type PreparedEntry = { entry: Entry; data: LabStateJsonValue };
type CheckpointGuard = (operation: LabCheckpointOperation) => { message: string; wait?: boolean } | undefined;
type CheckpointOptions = {
  labId?: string;
  begin?(operation: LabCheckpointOperation): () => void;
  canWait?(): boolean;
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
  private readonly checkpointGuards = new Set<CheckpointGuard>();
  private readonly checkpoint: CheckpointOptions;
  private checkpointOperation = false;
  private applyingCheckpoint = false;
  private quickSlot?: LabCheckpoint;
  private runTimeSeconds = 0;

  constructor(checkpoint: CheckpointOptions = {}) { this.checkpoint = checkpoint; }

  get checkpointLabId() { return this.checkpoint.labId; }

  advanceRunTime(deltaSeconds: number): void { this.runTimeSeconds += deltaSeconds; }

  registerCheckpointGuard(guard: CheckpointGuard): () => void {
    this.requireActive();
    this.checkpointGuards.add(guard);
    return () => this.checkpointGuards.delete(guard);
  }

  async captureCheckpoint(): Promise<LabCheckpoint> {
    const labId = this.requireLabId();
    const release = this.beginCheckpoint('save');
    try {
      await this.waitForCheckpoint('save');
      const { version, createdAt, modules } = this.createSnapshot();
      return { format: 'lab-checkpoint', labId, version, createdAt, modules, runTimeMs: Math.round(this.runTimeSeconds * 1000) };
    } finally { release(); }
  }

  async quickSave(): Promise<string> {
    const snapshot = await this.captureCheckpoint();
    this.requireActive();
    this.quickSlot = snapshot;
    return snapshot.createdAt;
  }

  async quickLoad(): Promise<void> {
    if (!this.quickSlot) throw new Error('当前 Lab 没有快速存档。');
    await this.restoreCheckpoint(this.quickSlot);
  }

  async restoreCheckpoint(value: unknown): Promise<void> {
    this.requireActive();
    if (!isPlainObject(value) || value.format !== 'lab-checkpoint') {
      throw new Error('请选择含有 Lab ID 的存档文件。');
    }
    if (value.labId !== this.requireLabId()) throw new Error('这个存档属于其他 Lab。');
    const runTimeMs = value.runTimeMs ?? 0;
    if (typeof runTimeMs !== 'number' || !Number.isSafeInteger(runTimeMs) || runTimeMs < 0) {
      throw new Error('存档中的运行时间无效。');
    }
    const prepared = this.prepareRestore(parseSnapshot({ ...value, format: 'lab-state' }));
    const sceneOwner = [...this.entries.values()].find(entry => entry.options.save?.loadCheckpoint);
    const scene = prepared.find(item => item.entry === sceneOwner);
    if (sceneOwner && !scene) throw new Error(`存档缺少“${sceneOwner.id}”。`);
    const release = this.beginCheckpoint('load');
    let backup: PreparedEntry[] = [];
    let applied = false;
    const apply = async () => {
      this.requireActive();
      if (applied) throw new Error('存档已经应用。');
      backup = prepared.map(({ entry }) => ({ entry, data: this.serialize(entry) }));
      applied = true;
      this.applyingCheckpoint = true;
      await this.applyRestore(prepared, true);
    };
    try {
      await this.waitForCheckpoint('load');
      if (scene) {
        const byId = new Map(prepared.map(({ entry, data }) => [entry.id, data]));
        await scene.entry.options.save!.loadCheckpoint!(scene.data, {
          read: (moduleId, key) => byId.get(`${moduleId}/${key}`),
          apply,
        });
        if (!applied) throw new Error('场景未完成读档。');
      } else {
        await apply();
      }
      this.runTimeSeconds = runTimeMs / 1000;
    } catch (error) {
      if (applied && !this.disposed) {
        try { await this.applyRestore(backup, true); }
        catch (rollbackError) {
          throw new AggregateError([error, rollbackError], '读档失败，原状态也未能完整恢复。');
        }
      }
      throw error;
    } finally {
      this.applyingCheckpoint = false;
      release();
      if (applied && !this.disposed) this.emit();
    }
  }

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
    if (options.save?.loadCheckpoint && [...this.entries.values()].some(entry => entry.options.save?.loadCheckpoint)) {
      throw new Error('一个 Lab 只能注册一个存档场景加载器。');
    }
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
    const modules: Record<string, Record<string, LabStateSnapshotEntry>> = Object.create(null);
    this.entries.forEach((entry) => {
      const save = entry.options.save;
      if (!save) return;
      const data = this.serialize(entry);
      (modules[entry.options.moduleId] ??= Object.create(null))[entry.options.key] = {
        version: entry.options.version,
        data,
      };
    });
    return {
      format: 'lab-state',
      version: 1,
      createdAt: new Date().toISOString(),
      modules: Object.fromEntries(Object.entries(modules).map(([id, entries]) => [id, { ...entries }])),
    };
  }

  async restore(snapshotValue: unknown): Promise<void> {
    this.requireActive();
    if (this.checkpointOperation) throw new Error('当前正在处理存档。');
    await this.applyRestore(this.prepareRestore(parseSnapshot(snapshotValue)), false);
    this.emit();
  }

  private prepareRestore(snapshot: LabStateSnapshot): PreparedEntry[] {
    const prepared: PreparedEntry[] = [];
    Object.entries(snapshot.modules).forEach(([moduleId, entries]) => {
      Object.entries(entries).forEach(([key, saved]) => {
        const id = `${moduleId}/${key}`;
        const direct = this.entries.get(id);
        const targets = direct ? [{ entry: direct, select: (data: unknown) => data }]
          : [...this.entries.values()].flatMap(entry => (entry.options.legacy ?? [])
            .filter(alias => alias.moduleId === moduleId && alias.key === key)
            .map(alias => ({ entry, select: alias.select })));
        if (!targets.length) throw new Error(`存档中的 LabState 引用“${id}”尚未注册。`);
        for (const { entry, select } of targets) {
          const save = entry.options.save;
          if (!save) throw new Error(`LabState 引用“${id}”不允许读取存档。`);
          if (prepared.some(item => item.entry === entry)) throw new Error(`存档重复指定 LabState 引用“${entry.id}”。`);
          const data = save.validate(select(cloneJson(saved.data)), saved.version);
          prepared.push({ entry, data: cloneJson(requireJson(data, `LabState 恢复“${id}”`)) });
        }
      });
    });
    return prepared;
  }

  private async applyRestore(prepared: readonly PreparedEntry[], checkpoint: boolean): Promise<void> {
    for (const { entry, data } of prepared) entry.options.save!.restore(entry.current, data);
    for (const { entry } of prepared) {
      await entry.options.save!.afterRestore?.(entry.current, { checkpoint });
    }
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
    this.checkpointGuards.clear();
    this.quickSlot = undefined;
    this.disposed = true;
  }

  private emit(): void {
    if (this.applyingCheckpoint) return;
    this.listeners.forEach((listener) => listener());
  }

  private requireActive(): void {
    if (this.disposed) throw new Error('LabState 已释放。');
  }

  private serialize(entry: Entry): LabStateJsonValue {
    return cloneJson(requireJson(entry.options.save!.serialize(entry.current), `LabState 存档“${entry.id}”`));
  }

  private requireLabId(): string {
    if (!this.checkpoint.labId) throw new Error('当前 Lab 没有可用于存档的 Lab ID。');
    return this.checkpoint.labId;
  }

  private beginCheckpoint(operation: LabCheckpointOperation): () => void {
    this.requireActive();
    if (this.checkpointOperation) throw new Error('当前正在处理存档。');
    const release = this.checkpoint.begin?.(operation);
    this.checkpointOperation = true;
    return () => {
      this.checkpointOperation = false;
      release?.();
    };
  }

  private async waitForCheckpoint(operation: LabCheckpointOperation): Promise<void> {
    while (true) {
      this.requireActive();
      let waiting: string | undefined;
      for (const guard of this.checkpointGuards) {
        const issue = guard(operation);
        if (!issue) continue;
        if (!issue.wait || operation === 'load' || this.checkpoint.canWait?.() === false) throw new Error(issue.message);
        waiting ??= issue.message;
      }
      if (!waiting) return;
      await new Promise(resolve => setTimeout(resolve, 25));
    }
  }
}

export const createLabState = (checkpoint?: CheckpointOptions): LabState => new LabState(checkpoint);
