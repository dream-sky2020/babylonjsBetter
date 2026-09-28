import type { scanDungeonDocumentObstacles } from '../dungeon-obstacle';
import { createServiceToken } from '../system-runtime/ServiceToken';
import type { createDungeonTraversalWorld } from '../dungeon-traversal';
import type { createDungeonMovementResolver } from '../dungeon-movement';
import { createDungeonRuntime } from './dungeonRuntime';
import type { DungeonMapDocumentV2 } from '../map-document';
import type { DungeonPlayerSpawnBinding } from '../dungeon-player-spawn';
import type { DungeonRuntime } from './dungeonRuntime.types';

export type DungeonRuntimeFactories = {
  obstacles?: typeof scanDungeonDocumentObstacles;
  traversal?: typeof createDungeonTraversalWorld;
  movement?: typeof createDungeonMovementResolver;
};

/** Explicit per-host installation. The legacy factory remains a full-runtime convenience API. */
export class DungeonRuntimeAssembly {
  private factories: DungeonRuntimeFactories = {};
  private prepared = false;
  private pauseCount = 0;
  private activeLoadId: number | null = null;
  private candidateLoadId: number | null = null;
  private phase: 'idle' | 'preparing' | 'ready' | 'failed' = 'idle';
  private failure: string | null = null;
  private readonly listeners = new Set<() => void>();

  inspect() {
    return {
      activeLoadId: this.activeLoadId, candidateLoadId: this.candidateLoadId,
      phase: this.phase, paused: this.isPaused, failure: this.failure,
      preparationOrder: [
        ...Object.keys(this.factories),
        'restore-save-and-entrance',
        ...this.preparers.keys(),
      ],
    };
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  }

  private changed(): void {
    for (const listener of this.listeners) {
      try { listener(); } catch (error) { console.error('Session 观察者失败。', error); }
    }
  }

  beginSession(loadId: number): void {
    this.candidateLoadId = loadId; this.phase = 'preparing'; this.failure = null; this.changed();
  }

  commitSession(loadId: number): void {
    if (this.candidateLoadId !== loadId) throw new Error('不能提交过期 Session。');
    this.activeLoadId = loadId; this.candidateLoadId = null; this.phase = 'ready'; this.changed();
  }

  failSession(loadId: number, error: unknown): void {
    if (this.candidateLoadId !== loadId) return;
    this.candidateLoadId = null; this.phase = 'failed';
    this.failure = error instanceof Error ? error.message : String(error);
    this.changed();
  }

  dispose(): void {
    this.factories = {}; this.preparers.clear(); this.preparations = new WeakMap();
    this.listeners.clear(); this.activeLoadId = null; this.candidateLoadId = null;
  }
  get isPaused(): boolean { return this.pauseCount > 0; }

  acquirePause(): () => void {
    this.pauseCount += 1; this.changed();
    let released = false;
    return () => { if (!released) { released = true; this.pauseCount -= 1; this.changed(); } };
  }
  private preparers = new Map<string, (runtime: DungeonRuntime, loadId: number) => unknown>();
  private preparations = new WeakMap<DungeonRuntime, ReadonlyMap<string, unknown>>();

  install<K extends keyof DungeonRuntimeFactories>(key: K, factory: NonNullable<DungeonRuntimeFactories[K]>): () => void {
    if (this.prepared) throw new Error('系统必须在首次准备 Session 前安装。');
    if (this.factories[key]) throw new Error('重复安装地牢能力：' + key);
    this.factories[key] = factory;
    return () => { delete this.factories[key]; };
  }

  registerPreparation<T>(id: string, prepare: (runtime: DungeonRuntime, loadId: number) => T): () => void {
    if (this.prepared || this.preparers.has(id)) throw new Error('无法注册 Session 准备步骤：' + id);
    this.preparers.set(id, prepare);
    return () => { this.preparers.delete(id); };
  }

  create(document: DungeonMapDocumentV2, spawn: DungeonPlayerSpawnBinding): DungeonRuntime {
    this.prepared = true;
    if (this.factories.movement && !this.factories.traversal) throw new Error('移动系统缺少通行系统。');
    return createDungeonRuntime(document, spawn, 'south', { systems: { ...this.factories }, registerPlayer: false });
  }

  /** Run after save/entrance restoration and before publishing the candidate Session. */
  prepare(runtime: DungeonRuntime, loadId: number): void {
    const values = new Map<string, unknown>();
    for (const [id, prepare] of this.preparers) values.set(id, prepare(runtime, loadId));
    this.preparations.set(runtime, values);
  }

  readPreparation<T>(runtime: DungeonRuntime, id: string): T {
    const values = this.preparations.get(runtime);
    if (!values?.has(id)) throw new Error('Session 尚未准备系统：' + id);
    return values.get(id) as T;
  }
}

export type DungeonRuntimeSystemInstaller = Pick<DungeonRuntimeAssembly,
  'install' | 'registerPreparation' | 'readPreparation' | 'isPaused'>;
export const DUNGEON_RUNTIME_ASSEMBLY_SERVICE_KEY = createServiceToken<DungeonRuntimeSystemInstaller>('dungeon:runtime-assembly');