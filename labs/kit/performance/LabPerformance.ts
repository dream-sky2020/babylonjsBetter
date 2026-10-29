import type { SystemTask } from '../../../core/system-runtime/SystemRunner.ts';
export type PerformanceKind = 'task' | 'event' | 'request' | 'host' | 'setup' | 'start' | 'dispose';
const lifecycle = (kind: PerformanceKind) => kind === 'setup' || kind === 'start' || kind === 'dispose';
type Counter = { count: number; total: number; max: number; samples: number[]; next: number };
type Entry = { moduleId: string; kind: PerformanceKind; calls: number; errors: number; self: Counter; inclusive: Counter; completion: Counter };
type TaskIdentity = { taskId: string; phase: SystemTask['phase']; description: string };
type TaskEntry = Omit<Entry, 'completion'> & TaskIdentity & { enabledChecks: number; runs: number; enabled: Counter; run: Counter; frame: Counter };
type FrameSample = { frame: number; timeMs: number; intervalMs: number; modules: { moduleId: string; ms: number }[]; tasks: { moduleId: string; taskId: string; phase: SystemTask['phase']; ms: number }[] };
const counter = (): Counter => ({ count: 0, total: 0, max: 0, samples: [], next: 0 });
const add = (c: Counter, ms: number) => { c.count++; c.total += ms; c.max = Math.max(c.max, ms); if (c.samples.length < 1024) c.samples.push(ms); else { c.samples[c.next] = ms; c.next = (c.next + 1) % 1024; } };
const summarize = (c: Counter) => {
  const sorted = c.samples.slice().sort((a, b) => a - b);
  return { count: c.count, totalMs: c.total, meanMs: c.count ? c.total / c.count : 0, maxMs: c.max,
    p95Ms: sorted[Math.max(0, Math.ceil(sorted.length * .95) - 1)] ?? 0, sampleCount: sorted.length };
};

/** Module boundaries only. Async continuation CPU and GPU work are not inferred. */
export class LabPerformance {
  enabled = false;
  private generation = 0;
  private lifecycleGeneration = 0;
  private entries = new Map<string, Entry>();
  private tasks = new Map<string, TaskEntry>();
  private moduleStats = new Map<string, Counter>();
  private stack: { children: number }[] = [];
  private frame: Map<string, number> | undefined;
  private taskFrame: Map<string, number> | undefined;
  private frameStats = new Map<string, Counter>();
  private frames = 0;
  private liveEnabled = false;
  private lastFrameTime: number | undefined;
  private pendingFrame: Omit<FrameSample, 'intervalMs' | 'timeMs'> | undefined;
  private liveIntervals: { timeMs: number; intervalMs: number }[] = [];
  private frameSamples: FrameSample[] = [];
  private thresholdMs = 33;
  private modules: readonly string[];
  private now: () => number;
  constructor(modules: readonly string[], now = () => performance.now()) { this.modules = modules; this.now = now; }
  start() { if (!this.enabled) { this.enabled = true; this.generation++; } }
  stop() { this.enabled = false; this.generation++; this.frame = undefined; this.taskFrame = undefined; this.pendingFrame = undefined; if (!this.liveEnabled) this.resetFrameTiming(); }
  clear() { this.generation++; this.lifecycleGeneration++; this.entries.clear(); this.tasks.clear(); this.moduleStats.clear(); this.frameStats.clear(); this.frames = 0; this.frame = undefined; this.taskFrame = undefined; this.frameSamples = []; this.pendingFrame = undefined; }
  setLiveEnabled(enabled: boolean) { this.liveEnabled = enabled; if (!enabled && !this.enabled) this.resetFrameTiming(); }
  setStallThreshold(ms: number) { if (Number.isFinite(ms) && ms > 0) this.thresholdMs = ms; }
  resetFrameTiming() { this.lastFrameTime = undefined; this.pendingFrame = undefined; this.liveIntervals = []; }
  /** Interval until this frame belongs to the previous completed frame, not this one. */
  frameStarted() {
    if (!this.enabled && !this.liveEnabled) return;
    const timeMs = this.now(), previous = this.lastFrameTime;
    this.lastFrameTime = timeMs;
    if (previous === undefined || timeMs <= previous || timeMs - previous > 1000) { this.pendingFrame = undefined; this.liveIntervals = []; return; }
    const intervalMs = timeMs - previous;
    this.liveIntervals.push({ timeMs, intervalMs });
    if (this.liveIntervals.length > 1024) this.liveIntervals.shift();
    if (this.enabled && this.pendingFrame) {
      this.frameSamples.push({ ...this.pendingFrame, timeMs, intervalMs });
      if (this.frameSamples.length > 1024) this.frameSamples.shift();
    }
    this.pendingFrame = undefined;
  }
  liveFrame() {
    const now = this.now(), recent = this.liveIntervals.filter(sample => now - sample.timeMs <= 1000);
    const sum = recent.reduce((total, sample) => total + sample.intervalMs, 0);
    return { fps: sum ? recent.length * 1000 / sum : 0, intervalMs: recent.at(-1)?.intervalMs ?? 0,
      maxMs: recent.reduce((max, sample) => Math.max(max, sample.intervalMs), 0) };
  }
  beginFrame() { if (this.enabled) { this.frame = new Map(); this.taskFrame = new Map(); } }
  endFrame() {
    if (!this.enabled || !this.frame) return;
    for (const id of new Set([...this.modules, ...this.frameStats.keys(), ...this.frame.keys()])) {
      const stats = this.frameStats.get(id) ?? counter(); add(stats, this.frame.get(id) ?? 0); this.frameStats.set(id, stats);
    }
    for (const [key, task] of this.tasks) add(task.frame, this.taskFrame?.get(key) ?? 0);
    this.pendingFrame = { frame: this.frames + 1,
      modules: [...this.frame].map(([moduleId, ms]) => ({ moduleId, ms })).sort((a, b) => b.ms - a.ms),
      tasks: [...(this.taskFrame ?? [])].flatMap(([key, ms]) => { const task = this.tasks.get(key); return task ? [{ moduleId: task.moduleId, taskId: task.taskId, phase: task.phase, ms }] : []; }).sort((a, b) => b.ms - a.ms) };
    this.frames++; this.frame = undefined; this.taskFrame = undefined;
  }
  measure<T>(moduleId: string, kind: PerformanceKind, callback: () => T, task?: TaskIdentity, operation: 'enabled' | 'run' = 'run'): T {
    if (!this.enabled && !lifecycle(kind)) return callback();
    const generation = this.currentGeneration(kind), started = this.now(), parent = this.stack.at(-1), scope = { children: 0 };
    this.stack.push(scope);
    let result: T, failed = false;
    try { result = callback(); }
    catch (error) { failed = true; throw error; }
    finally {
      const inclusive = Math.max(0, this.now() - started), self = Math.max(0, inclusive - scope.children);
      this.stack.pop(); if (parent) parent.children += inclusive;
      if (generation === this.currentGeneration(kind)) {
        const entry = this.entry(moduleId, kind); entry.calls++; if (failed) entry.errors++;
        add(entry.self, self); add(entry.inclusive, inclusive);
        if (!lifecycle(kind)) { const aggregate = this.moduleStats.get(moduleId) ?? counter(); add(aggregate, self); this.moduleStats.set(moduleId, aggregate); }
        if (!lifecycle(kind) && this.frame) this.frame.set(moduleId, (this.frame.get(moduleId) ?? 0) + self);
        if (kind === 'task' && task) {
          const key = JSON.stringify([moduleId, task.phase, task.taskId]);
          const detail = this.taskEntry(key, moduleId, task); detail.calls++; if (failed) detail.errors++;
          if (operation === 'enabled') detail.enabledChecks++; else detail.runs++;
          add(detail.self, self); add(detail.inclusive, inclusive); add(detail[operation], self);
          if (this.taskFrame) this.taskFrame.set(key, (this.taskFrame.get(key) ?? 0) + self);
        }
        if (failed && lifecycle(kind)) add(entry.completion, inclusive);
      }
    }
    // Observe completion separately; never replace the return value or keep a
    // synchronous nesting stack alive across await/concurrent listeners.
    if (result instanceof Promise) {
      void result.then(() => this.complete(moduleId, kind, started, generation, false), () => this.complete(moduleId, kind, started, generation, true));
    } else if (lifecycle(kind)) this.complete(moduleId, kind, started, generation, false);
    return result;
  }
  private entry(moduleId: string, kind: PerformanceKind) {
    const key = JSON.stringify([moduleId, kind]);
    let entry = this.entries.get(key);
    if (!entry) { entry = { moduleId, kind, calls: 0, errors: 0, self: counter(), inclusive: counter(), completion: counter() }; this.entries.set(key, entry); }
    return entry;
  }
  private taskEntry(key: string, moduleId: string, identity: TaskIdentity) {
    let task = this.tasks.get(key);
    if (!task) {
      const frame = counter(); frame.count = this.frames;
      frame.samples = Array(Math.min(this.frames, 1024)).fill(0);
      frame.next = this.frames >= 1024 ? this.frames % 1024 : 0;
      task = { moduleId, kind: 'task', ...identity, calls: 0, errors: 0, enabledChecks: 0, runs: 0,
        self: counter(), inclusive: counter(), enabled: counter(), run: counter(), frame };
      this.tasks.set(key, task);
    }
    return task;
  }
  private currentGeneration(kind: PerformanceKind) { return lifecycle(kind) ? this.lifecycleGeneration : this.generation; }
  private complete(moduleId: string, kind: PerformanceKind, started: number, generation: number, failed: boolean) {
    if (generation !== this.currentGeneration(kind)) return;
    const entry = this.entry(moduleId, kind); if (failed) entry.errors++;
    add(entry.completion, Math.max(0, this.now() - started));
  }
  inspect() {
    const entries = [...this.entries.values()].map(entry => ({ moduleId: entry.moduleId, kind: entry.kind, calls: entry.calls, errors: entry.errors,
      self: summarize(entry.self), inclusive: summarize(entry.inclusive), completion: summarize(entry.completion) }));
    const modules = [...new Set([...this.modules, ...entries.map(entry => entry.moduleId)])].map(moduleId => {
      const runtime = entries.filter(entry => entry.moduleId === moduleId && !lifecycle(entry.kind));
      return { moduleId, calls: runtime.reduce((n, entry) => n + entry.calls, 0), errors: runtime.reduce((n, entry) => n + entry.errors, 0),
        selfTotalMs: runtime.reduce((n, entry) => n + entry.self.totalMs, 0),
        frame: summarize(this.frameStats.get(moduleId) ?? counter()), invocation: summarize(this.moduleStats.get(moduleId) ?? counter()), categories: runtime,
        tasks: [...this.tasks.values()].filter(task => task.moduleId === moduleId).map(task => ({
          taskId: task.taskId, phase: task.phase, description: task.description, calls: task.calls, errors: task.errors,
          enabledChecks: task.enabledChecks, runs: task.runs, self: summarize(task.self), inclusive: summarize(task.inclusive),
          enabled: summarize(task.enabled), run: summarize(task.run), frame: summarize(task.frame),
        })) };
    });
    return { version: 1, enabled: this.enabled, frames: this.frames, sampleLimit: 1024, modules, lifecycle: entries.filter(entry => lifecycle(entry.kind)),
      frameTiming: { thresholdMs: this.thresholdMs, samples: this.frameSamples.map(sample => ({ ...sample, modules: sample.modules.map(m => ({ ...m })), tasks: sample.tasks.map(t => ({ ...t })) })) },
      coverage: '调度任务（按任务 ID/阶段区分运行与启用判断）、通信监听/请求处理、Host 调度/相机/渲染。任务明细已包含在模块总计中，不可重复相加。同步入口计时不含 await 后续执行；直接 DOM 回调、定时器、Babylon Observable 和 GPU 耗时未独立归属。P95 为最近最多 1024 个样本。' };
  }
  dispose() { this.stop(); this.clear(); }
}

/** Lab-only adapter: Core scheduling, enable/interval semantics and failure handling remain unchanged. */
export function profileSystemTask(stats: LabPerformance, owner: string, task: SystemTask): SystemTask {
  const identity = { taskId: task.id, phase: task.phase, description: task.description };
  return { ...task,
    ...(task.enabled ? { enabled: () => stats.measure(owner, 'task', () => task.enabled!(), identity, 'enabled') } : {}),
    run: delta => stats.measure(owner, 'task', () => task.run(delta), identity, 'run'),
  };
}
