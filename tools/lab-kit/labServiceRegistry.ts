export type LabLifecyclePhase = 'prepare' | 'setup' | 'restore' | 'start' | 'ready' | 'dispose';

export type LabServiceScope = {
  set<T>(key: string, value: T): void;
  get<T>(key: string): T;
  find<T>(key: string): T | undefined;
  delete(key: string): void;
};

type ServiceEntry = {
  readonly ownerModuleId: string;
  readonly value: unknown;
};

export class LabServiceRegistry {
  private readonly services = new Map<string, ServiceEntry>();
  private phase: LabLifecyclePhase = 'prepare';

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
      set: <T>(key: string, value: T) => {
        const existing = this.services.get(key);
        if (existing) {
          throw new Error(`Lab 服务“${key}”已经由模块“${existing.ownerModuleId}”注册。`);
        }
        if (this.phase !== 'setup') {
          throw new Error(
            `模块“${moduleId}”不能在 ${this.phase} 阶段首次注册 Lab 服务“${key}”；服务必须在 setup 阶段注册稳定引用。`,
          );
        }
        this.services.set(key, { ownerModuleId: moduleId, value });
      },
      get: <T>(key: string): T => {
        const entry = this.services.get(key);
        if (!entry) {
          throw new Error(`模块“${moduleId}”在 ${this.phase} 阶段读取 Lab 服务“${key}”，但该服务尚未注册。`);
        }
        assertAccessible(key, entry);
        return entry.value as T;
      },
      find: <T>(key: string): T | undefined => {
        const entry = this.services.get(key);
        if (!entry) return undefined;
        assertAccessible(key, entry);
        return entry.value as T;
      },
      delete: (key: string) => {
        const entry = this.services.get(key);
        if (!entry) return;
        if (entry.ownerModuleId !== moduleId) {
          throw new Error(`模块“${moduleId}”不能删除模块“${entry.ownerModuleId}”拥有的服务“${key}”。`);
        }
        this.services.delete(key);
      },
    });
  }

  clear(): void {
    this.services.clear();
  }
}
