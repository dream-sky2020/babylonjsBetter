/** Shared by game hosts and Labs. No DOM, Babylon or wall-clock dependency. */
export type SystemPhase = 'simulation' | 'presentation' | 'debug';
export type SystemTask = Readonly<{
  id: string;
  phase: SystemPhase;
  order: number;
  description: string;
  intervalSeconds?: number;
  enabled?: () => boolean;
  run(deltaSeconds: number): void;
}>;

export class SystemTaskFailure extends Error {
  readonly owner: string;
  readonly taskId: string;
  constructor(owner: string, task: SystemTask, cause: unknown) {
    super('系统任务失败：' + owner + '/' + task.id + ' (' + task.phase + ')', { cause });
    this.owner = owner; this.taskId = task.id;
  }
}

export class SystemRunner {
  failure: SystemTaskFailure | null = null;
  private tasks = new Map<string, { owner: string; task: SystemTask; elapsed: number }>();
  private ordered: Array<{ owner: string; task: SystemTask; elapsed: number }> = [];
  private listeners = new Set<() => void>();
  private paused = false;

  register(owner: string, task: SystemTask): () => void {
    const key = `${owner}/${task.id}`;
    if (this.tasks.has(key)) throw new Error(`重复系统任务：${key}`);
    if (!Number.isFinite(task.order) || (task.intervalSeconds !== undefined
      && (!Number.isFinite(task.intervalSeconds) || task.intervalSeconds < 0))) {
      throw new Error(`无效系统调度参数：${key}`);
    }
    this.tasks.set(key, { owner, task, elapsed: 0 });
    this.rebuild();
    return () => { if (this.tasks.delete(key)) this.rebuild(); };
  }

  setPaused(paused: boolean): void {
    if (this.failure && !paused) return;
    if (this.paused !== paused) { this.paused = paused; this.changed(); }
  }
  get isPaused(): boolean { return this.paused; }

  update(phase: SystemPhase, deltaSeconds: number): void {
    if (!Number.isFinite(deltaSeconds) || deltaSeconds < 0) throw new Error('系统时间必须为非负有限数。');
    if (phase === 'simulation' && this.paused) return;
    for (const entry of this.ordered) {
      const { owner, task } = entry;
      if (task.phase !== phase || this.tasks.get(`${owner}/${task.id}`) !== entry) continue;
      try {
        if (task.enabled && !task.enabled()) { entry.elapsed = 0; continue; }
        entry.elapsed += deltaSeconds;
        if (entry.elapsed < (task.intervalSeconds ?? 0)) continue;
        const elapsed = entry.elapsed;
        entry.elapsed = 0;
        task.run(elapsed);
      } catch (error) {
        this.failure = new SystemTaskFailure(owner, task, error);
        this.paused = true;
        this.changed();
        throw this.failure;
      }
    }
  }

  removeOwner(owner: string): void {
    for (const [key, entry] of this.tasks) if (entry.owner === owner) this.tasks.delete(key);
    this.rebuild();
  }

  inspect() {
    return this.ordered.map(({ owner, task }) => ({ owner, id: task.id, phase: task.phase,
      order: task.order, description: task.description, intervalSeconds: task.intervalSeconds }));
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  }

  dispose(): void { this.tasks.clear(); this.ordered = []; this.listeners.clear(); }

  private changed(): void {
    for (const listener of this.listeners) {
      try { listener(); } catch (error) { console.error('调度观察者失败。', error); }
    }
  }

  private rebuild(): void {
    const phases: SystemPhase[] = ['simulation', 'presentation', 'debug'];
    this.ordered = [...this.tasks.values()].sort((a, b) =>
      phases.indexOf(a.task.phase) - phases.indexOf(b.task.phase)
      || a.task.order - b.task.order || `${a.owner}/${a.task.id}`.localeCompare(`${b.owner}/${b.task.id}`));
    this.changed();
  }
}
