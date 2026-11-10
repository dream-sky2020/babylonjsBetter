import type { ServiceToken } from '@/core/system-runtime/ServiceToken';
const serviceId = (key: string | { readonly id: string }) => typeof key === 'string' ? key : key.id;

export type LabLifecyclePhase = 'prepare' | 'setup' | 'restore' | 'start' | 'ready' | 'dispose';
export type LabServiceInspection = { id: string; owner: string; consumers: readonly string[]; actions: readonly string[] };

export type LabServiceCallOrigin = { source?: string; target?: string; actorId?: string; sessionId?: number };
export type LabServiceCall = LabServiceCallOrigin & {
  id: number; at: number; caller: string; serviceId?: string; owner?: string; operation: string;
  status: 'pending' | 'succeeded' | 'rejected' | 'failed'; error?: string;
};
type LabServiceAction = (input: Readonly<Record<string, unknown>>, origin: LabServiceCallOrigin) => boolean;
type ServiceFunction = (...args: never[]) => unknown;
type ServiceMethod<T> = { [K in keyof T]-?: T[K] extends ServiceFunction ? K : never }[keyof T] & string;
type ServiceFunctionAt<T, K extends keyof T> = Extract<T[K], ServiceFunction>;

export type LabServiceScope = {
  set<T>(key: string | ServiceToken<T>, value: NoInfer<T>, actions?: Readonly<Record<string, LabServiceAction>>): void;
  invoke<T, K extends ServiceMethod<T>>(key: ServiceToken<T>, method: K,
    args: Parameters<ServiceFunctionAt<T, K>>, origin?: LabServiceCallOrigin): ReturnType<ServiceFunctionAt<T, K>>;
  invokeAction(id: string, input: Readonly<Record<string, unknown>>, origin?: LabServiceCallOrigin): boolean;
  get<T>(key: string | ServiceToken<T>): T;
  find<T>(key: string | ServiceToken<T>): T | undefined;
  delete(key: string | { readonly id: string }): void;
};

type ServiceEntry = {
  readonly ownerModuleId: string;
  readonly value: unknown;
  readonly consumers: Set<string>;
  readonly actionIds: readonly string[];
};

export class LabServiceRegistry {
  private readonly services = new Map<string, ServiceEntry>();
  private readonly actions = new Map<string, { serviceId: string; execute: LabServiceAction }>();
  private readonly calls: LabServiceCall[] = [];
  private readonly callListeners = new Set<() => void>();
  private nextCallId = 0;
  private phase: LabLifecyclePhase = 'prepare';
  private readonly listeners = new Set<() => void>();

  inspect(): readonly LabServiceInspection[] {
    return [...this.services].map(([id, entry]) => ({
      id, owner: entry.ownerModuleId, consumers: [...entry.consumers], actions: [...entry.actionIds],
    }));
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  }

  inspectCalls(): readonly LabServiceCall[] {
    return this.calls.map(call => ({ ...call }));
  }

  subscribeCalls(listener: () => void): () => void {
    this.callListeners.add(listener);
    return () => { this.callListeners.delete(listener); };
  }

  private recordCall<T>(
    caller: string, serviceId: string | undefined, operation: string, origin: LabServiceCallOrigin, execute: () => T,
  ): T {
    const call: LabServiceCall = {
      id: ++this.nextCallId, at: Date.now(), caller, serviceId, owner: serviceId ? this.services.get(serviceId)?.ownerModuleId : undefined,
      operation, source: origin.source, target: origin.target, actorId: origin.actorId, sessionId: origin.sessionId, status: 'pending',
    };
    const notify = () => {
      if (!this.calls.includes(call)) return;
      for (const listener of this.callListeners) {
        try { listener(); } catch (error) { console.error('服务调用记录观察者失败。', error); }
      }
    };
    this.calls.push(call);
    if (this.calls.length > 100) this.calls.shift();
    const succeed = (result: unknown) => { call.status = result === false ? 'rejected' : 'succeeded'; notify(); };
    const fail = (error: unknown) => {
      call.status = 'failed';
      call.error = (error instanceof Error ? error.message : String(error)).slice(0, 500);
      notify();
    };
    try {
      const result = execute();
      if (result != null && (typeof result === 'object' || typeof result === 'function')
        && 'then' in result && typeof result.then === 'function') {
        void Promise.resolve(result).then(succeed, fail);
        notify();
      } else succeed(result);
      return result;
    } catch (error) {
      fail(error);
      throw error;
    }
  }

  private unregister(id: string, entry: ServiceEntry): void {
    for (const actionId of entry.actionIds) this.actions.delete(actionId);
    this.services.delete(id);
  }

  private changed(): void {
    for (const listener of this.listeners) {
      try { listener(); } catch (error) { console.error('服务关系观察者失败。', error); }
    }
  }

  removeOwner(moduleId: string): void {
    for (const [key, entry] of this.services) {
      if (entry.ownerModuleId === moduleId) this.unregister(key, entry);
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
      set: <T>(token: string | ServiceToken<T>, value: NoInfer<T>, actions: Readonly<Record<string, LabServiceAction>> = {}) => {
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
        const entries = Object.entries(actions);
        for (const [id] of entries) {
          const previous = this.actions.get(id);
          if (previous) throw new Error(`Lab 服务操作“${id}”已经由服务“${previous.serviceId}”公开。`);
        }
        this.services.set(key, { ownerModuleId: moduleId, value, consumers: new Set(), actionIds: entries.map(([id]) => id) });
        for (const [id, execute] of entries) this.actions.set(id, { serviceId: key, execute });
        this.changed();
      },
      get: <T>(token: string | ServiceToken<T>): T => {
        const key = serviceId(token);
        const entry = this.services.get(key);
        if (!entry) {
          throw new Error(`模块“${moduleId}”在 ${this.phase} 阶段读取 Lab 服务“${key}”，但该服务尚未注册。`);
        }
        assertAccessible(key, entry);
        if (entry.ownerModuleId !== moduleId && !entry.consumers.has(moduleId)) { entry.consumers.add(moduleId); this.changed(); }
        return entry.value as T;
      },
      find: <T>(token: string | ServiceToken<T>): T | undefined => {
        const key = serviceId(token);
        const entry = this.services.get(key);
        if (!entry) return undefined;
        assertAccessible(key, entry);
        if (entry.ownerModuleId !== moduleId && !entry.consumers.has(moduleId)) { entry.consumers.add(moduleId); this.changed(); }
        return entry.value as T;
      },
      invoke: <T, K extends ServiceMethod<T>>(token: ServiceToken<T>, method: K,
        args: Parameters<ServiceFunctionAt<T, K>>, origin: LabServiceCallOrigin = {}): ReturnType<ServiceFunctionAt<T, K>> => {
        const key = serviceId(token);
        return this.recordCall(moduleId, key, method, origin, () => {
          const entry = this.services.get(key);
          if (!entry) throw new Error(`当前 Lab 未提供服务“${key}”。`);
          const implementation = (entry.value as T)[method];
          if (typeof implementation !== 'function') throw new Error(`服务“${key}”未提供方法“${method}”。`);
          return Reflect.apply(implementation, entry.value, args) as ReturnType<ServiceFunctionAt<T, K>>;
        });
      },
      invokeAction: (id: string, input: Readonly<Record<string, unknown>>, origin: LabServiceCallOrigin = {}): boolean => {
        const action = this.actions.get(id);
        return this.recordCall(moduleId, action?.serviceId, id, origin, () => {
          if (!action) throw new Error(`当前 Lab 未公开服务操作“${id}”。`);
          return action.execute(input, origin);
        });
      },
      delete: (token: string | { readonly id: string }) => {
        const key = serviceId(token);
        const entry = this.services.get(key);
        if (!entry) return;
        if (entry.ownerModuleId !== moduleId) {
          throw new Error(`模块“${moduleId}”不能删除模块“${entry.ownerModuleId}”拥有的服务“${key}”。`);
        }
        this.unregister(key, entry);
        this.changed();
      },
    });
  }

  clear(): void {
    this.services.clear();
    this.actions.clear();
    this.calls.length = 0;
    this.listeners.clear();
    this.callListeners.clear();
  }
}
