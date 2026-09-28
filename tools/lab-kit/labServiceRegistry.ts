import type { ServiceToken } from '@/core/system-runtime/ServiceToken';
const serviceId = (key: string | { readonly id: string }) => typeof key === 'string' ? key : key.id;

export type LabLifecyclePhase = 'prepare' | 'setup' | 'restore' | 'start' | 'ready' | 'dispose';

export type LabServiceScope = {
  set<T>(key: string | ServiceToken<T>, value: NoInfer<T>): void;
  get<T>(key: string | ServiceToken<T>): T;
  find<T>(key: string | ServiceToken<T>): T | undefined;
  delete(key: string | { readonly id: string }): void;
};

type ServiceEntry = {
  readonly ownerModuleId: string;
  readonly value: unknown;
  readonly consumers: Set<string>;
};

export class LabServiceRegistry {
  private readonly services = new Map<string, ServiceEntry>();
  private phase: LabLifecyclePhase = 'prepare';
  private readonly listeners = new Set<() => void>();

  inspect() {
    return [...this.services].map(([id, entry]) => ({
      id, owner: entry.ownerModuleId, consumers: [...entry.consumers],
    }));
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  }

  private changed(): void {
    for (const listener of this.listeners) {
      try { listener(); } catch (error) { console.error('服务关系观察者失败。', error); }
    }
  }

  removeOwner(moduleId: string): void {
    for (const [key, entry] of this.services) {
      if (entry.ownerModuleId === moduleId) this.services.delete(key);
      else entry.consumers.delete(moduleId);
    }
    this.changed();
  }

  setPhase(phase: LabLifecyclePhase): void {
    this.phase = phase;
  }

  scope(moduleId: string, accessibleModuleIds: ReadonlySet<string>): LabServiceScope {
    const assertAccessible = (key: string, entry: ServiceEntry) => {
      if (entry.ownerModuleId !== moduleId && !accessibleModuleIds.has(entry.ownerModuleId)) {
        throw new Error(
          `模块“${moduleId}”读取了模块“${entry.ownerModuleId}”的服务“${key}”，但没有声明对应依赖。`,
        );
      }
    };
    return Object.freeze({
      set: <T>(token: string | ServiceToken<T>, value: NoInfer<T>) => {
        const key = serviceId(token);
        const existing = this.services.get(key);
        if (existing) {
          throw new Error(`Lab 服务“${key}”已经由模块“${existing.ownerModuleId}”注册。`);
        }
        if (this.phase !== 'setup') {
          throw new Error(
            `模块“${moduleId}”不能在 ${this.phase} 阶段首次注册 Lab 服务“${key}”；服务必须在 setup 阶段注册稳定引用。`,
          );
        }
        this.services.set(key, { ownerModuleId: moduleId, value, consumers: new Set() });
        this.changed();
      },
      get: <T>(token: string | ServiceToken<T>): T => {
        const key = serviceId(token);
        const entry = this.services.get(key);
        if (!entry) {
          throw new Error(`模块“${moduleId}”在 ${this.phase} 阶段读取 Lab 服务“${key}”，但该服务尚未注册。`);
        }
        assertAccessible(key, entry);
        if (!entry.consumers.has(moduleId)) { entry.consumers.add(moduleId); this.changed(); }
        return entry.value as T;
      },
      find: <T>(token: string | ServiceToken<T>): T | undefined => {
        const key = serviceId(token);
        const entry = this.services.get(key);
        if (!entry) return undefined;
        assertAccessible(key, entry);
        if (!entry.consumers.has(moduleId)) { entry.consumers.add(moduleId); this.changed(); }
        return entry.value as T;
      },
      delete: (token: string | { readonly id: string }) => {
        const key = serviceId(token);
        const entry = this.services.get(key);
        if (!entry) return;
        if (entry.ownerModuleId !== moduleId) {
          throw new Error(`模块“${moduleId}”不能删除模块“${entry.ownerModuleId}”拥有的服务“${key}”。`);
        }
        this.services.delete(key);
        this.changed();
      },
    });
  }

  clear(): void {
    this.services.clear();
    this.listeners.clear();
  }
}
