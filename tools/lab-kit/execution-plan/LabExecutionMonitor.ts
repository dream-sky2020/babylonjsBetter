import type {
  LabExecutionListener,
  LabExecutionPlan,
  LabModuleExecutionInspection,
  LabModuleExecutionStatus,
} from './labExecutionPlan.types';

type MutableExecution = {
  status: LabModuleExecutionStatus;
  setupStartedAt?: number;
  setupDurationMs?: number;
  startStartedAt?: number;
  startDurationMs?: number;
  error?: string;
};

export class LabExecutionMonitor {
  private readonly states = new Map<string, MutableExecution>();
  private readonly listeners = new Set<LabExecutionListener>();

  constructor(readonly plan: LabExecutionPlan) {
    plan.entries.forEach(({ moduleId }) => this.states.set(moduleId, { status: 'pending' }));
  }

  beginSetup(moduleId: string): void {
    this.update(moduleId, { status: 'setting-up', setupStartedAt: performance.now() });
  }

  completeSetup(moduleId: string): void {
    const state = this.requireState(moduleId);
    this.update(moduleId, {
      status: 'setup',
      setupDurationMs: performance.now() - (state.setupStartedAt ?? performance.now()),
    });
  }

  beginStart(moduleId: string): void {
    this.update(moduleId, { status: 'starting', startStartedAt: performance.now() });
  }

  completeStart(moduleId: string): void {
    const state = this.requireState(moduleId);
    this.update(moduleId, {
      status: 'started',
      startDurationMs: performance.now() - (state.startStartedAt ?? performance.now()),
    });
  }

  beginDispose(moduleId: string): void {
    const state = this.requireState(moduleId);
    if (state.status === 'disposed') return;
    this.update(moduleId, { status: 'disposing' });
  }

  completeDispose(moduleId: string): void {
    this.update(moduleId, { status: 'disposed' });
  }

  fail(moduleId: string, error: unknown): void {
    this.update(moduleId, {
      status: 'failed',
      error: error instanceof Error ? error.message : String(error),
    });
  }

  inspect(): readonly LabModuleExecutionInspection[] {
    return this.plan.entries.map((entry) => {
      const state = this.requireState(entry.moduleId);
      return {
        moduleId: entry.moduleId,
        dependencies: entry.dependencies,
        depth: entry.depth,
        executionIndex: entry.executionIndex,
        requested: entry.requested,
        status: state.status,
        ...(state.setupDurationMs === undefined ? {} : { setupDurationMs: state.setupDurationMs }),
        ...(state.startDurationMs === undefined ? {} : { startDurationMs: state.startDurationMs }),
        ...(state.error === undefined ? {} : { error: state.error }),
      };
    });
  }

  subscribe(listener: LabExecutionListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private update(moduleId: string, patch: Partial<MutableExecution>): void {
    Object.assign(this.requireState(moduleId), patch);
    this.listeners.forEach((listener) => listener());
  }

  private requireState(moduleId: string): MutableExecution {
    const state = this.states.get(moduleId);
    if (!state) throw new Error(`模块“${moduleId}”不在当前 LabExecutionPlan 中。`);
    return state;
  }
}
