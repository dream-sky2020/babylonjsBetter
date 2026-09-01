import {
  isRuntimeDataValue,
  type RuntimeDataDefinition,
} from './runtimeDataDefinition';
import { RuntimeModuleRegistry, type RuntimeModuleToken } from './runtimeModuleRegistry';
import { createRuntimeScopeToken, getRuntimeScopeId, normalizeRuntimeScopeAddress } from './runtimeScope';
import type {
  RuntimeDataChange,
  RuntimeDataInspection,
  RuntimeDataListener,
  RuntimeScopeAddress,
  RuntimeScopeToken,
  RuntimeDataValue,
} from './runtime.types';

type StoredRuntimeData = Map<string, RuntimeDataValue>;

type RuntimeListenerEntry = {
  readonly dataKey: string;
  readonly scope: RuntimeScopeToken;
  readonly listener: RuntimeDataListener;
};

export type RuntimePublicReader = {
  read<TData extends RuntimeDataValue>(
    definition: RuntimeDataDefinition<TData>,
    scope: RuntimeScopeToken,
  ): TData | null | undefined;
  subscribe<TData extends RuntimeDataValue>(
    definition: RuntimeDataDefinition<TData>,
    scope: RuntimeScopeToken,
    listener: RuntimeDataListener<TData>,
  ): () => void;
  inspect(): readonly RuntimeDataInspection[];
};

export type RuntimeModuleScopeAccess = {
  read<TData extends RuntimeDataValue>(definition: RuntimeDataDefinition<TData>): TData | undefined;
  ensure<TData extends RuntimeDataValue>(definition: RuntimeDataDefinition<TData>): TData;
  write<TData extends RuntimeDataValue>(definition: RuntimeDataDefinition<TData>, value: TData): void;
  update<TData extends RuntimeDataValue>(
    definition: RuntimeDataDefinition<TData>,
    updater: (current: TData | undefined) => TData,
  ): TData;
  clear<TData extends RuntimeDataValue>(definition: RuntimeDataDefinition<TData>): void;
  subscribe<TData extends RuntimeDataValue>(
    definition: RuntimeDataDefinition<TData>,
    listener: RuntimeDataListener<TData>,
  ): () => void;
};

export type RuntimeModuleHandle = {
  readonly id: string;
  registerData<TData extends RuntimeDataValue>(definition: RuntimeDataDefinition<TData>): void;
  openScope(scope: RuntimeScopeToken): RuntimeModuleScopeAccess;
};

const cloneData = <TData extends RuntimeDataValue>(value: TData): TData => structuredClone(value);

export class RuntimeDataStore {
  private disposed = false;
  private readonly modules = new RuntimeModuleRegistry();
  private readonly definitions = new Map<string, RuntimeDataDefinition>();
  private readonly knownScopes = new WeakSet<object>();
  private readonly scopesById = new Map<string, RuntimeScopeToken>();
  private readonly scopeData = new Map<RuntimeScopeToken, StoredRuntimeData>();
  private readonly listeners = new Set<RuntimeListenerEntry>();

  readonly publicData: RuntimePublicReader = Object.freeze({
    read: <TData extends RuntimeDataValue>(definition: RuntimeDataDefinition<TData>, scope: RuntimeScopeToken) => {
      if (definition.visibility !== 'public') return null;
      return this.read(definition, scope);
    },
    subscribe: <TData extends RuntimeDataValue>(
      definition: RuntimeDataDefinition<TData>,
      scope: RuntimeScopeToken,
      listener: RuntimeDataListener<TData>,
    ) => {
      if (definition.visibility !== 'public') throw new Error(`Runtime 数据“${definition.key}”是 Private 数据。`);
      return this.subscribe(definition, scope, listener);
    },
    inspect: () => this.inspect(),
  });

  registerModule(moduleId: string): RuntimeModuleHandle {
    this.requireActive();
    const token = this.modules.register(moduleId);
    return Object.freeze({
      id: token.id,
      registerData: <TData extends RuntimeDataValue>(definition: RuntimeDataDefinition<TData>) => {
        this.registerDefinition(token, definition);
      },
      openScope: (scope: RuntimeScopeToken) => this.createModuleScopeAccess(token, scope),
    });
  }

  createScope(address: RuntimeScopeAddress): RuntimeScopeToken {
    this.requireActive();
    const normalized = normalizeRuntimeScopeAddress(address);
    const scopeId = `${normalized.kind}:${normalized.key}`;
    if (this.scopesById.has(scopeId)) throw new Error(`Runtime Scope“${scopeId}”已经存在。`);
    const scope = createRuntimeScopeToken(normalized);
    this.knownScopes.add(scope);
    this.scopesById.set(scopeId, scope);
    this.scopeData.set(scope, new Map());
    return scope;
  }

  findScope(address: RuntimeScopeAddress): RuntimeScopeToken | null {
    this.requireActive();
    const normalized = normalizeRuntimeScopeAddress(address);
    return this.scopesById.get(`${normalized.kind}:${normalized.key}`) ?? null;
  }

  releaseScope(scope: RuntimeScopeToken): void {
    this.requireScope(scope);
    const stored = this.scopeData.get(scope)!;
    [...stored.keys()].forEach((dataKey) => {
      const definition = this.definitions.get(dataKey);
      if (definition) this.emit(definition, scope, stored.get(dataKey), undefined);
    });
    stored.clear();
    this.listeners.forEach((entry) => {
      if (entry.scope === scope) this.listeners.delete(entry);
    });
    this.scopeData.delete(scope);
    this.scopesById.delete(getRuntimeScopeId(scope));
    this.knownScopes.delete(scope);
  }

  dispose(): void {
    if (this.disposed) return;
    [...this.scopeData.keys()].forEach((scope) => this.releaseScope(scope));
    this.listeners.clear();
    this.definitions.clear();
    this.disposed = true;
  }

  get registeredModuleIds(): readonly string[] {
    return this.modules.moduleIds;
  }

  private registerDefinition<TData extends RuntimeDataValue>(
    token: RuntimeModuleToken,
    definition: RuntimeDataDefinition<TData>,
  ): void {
    this.requireActive();
    this.modules.requireOwner(token, definition.moduleId);
    if (this.definitions.has(definition.key)) throw new Error(`Runtime Data Key“${definition.key}”已经注册。`);
    this.definitions.set(definition.key, definition);
  }

  private createModuleScopeAccess(token: RuntimeModuleToken, scope: RuntimeScopeToken): RuntimeModuleScopeAccess {
    this.modules.requireOwner(token);
    this.requireScope(scope);
    const requireOwned = <TData extends RuntimeDataValue>(definition: RuntimeDataDefinition<TData>) => {
      this.modules.requireOwner(token, definition.moduleId);
      this.requireDefinition(definition, scope);
    };
    return Object.freeze({
      read: <TData extends RuntimeDataValue>(definition: RuntimeDataDefinition<TData>) => {
        requireOwned(definition);
        return this.read(definition, scope);
      },
      ensure: <TData extends RuntimeDataValue>(definition: RuntimeDataDefinition<TData>) => {
        requireOwned(definition);
        const current = this.read(definition, scope);
        if (current !== undefined) return current;
        if (!definition.createDefault) throw new Error(`Runtime 数据“${definition.key}”没有默认值工厂。`);
        const value = definition.createDefault();
        this.write(definition, scope, value);
        return cloneData(value);
      },
      write: <TData extends RuntimeDataValue>(definition: RuntimeDataDefinition<TData>, value: TData) => {
        requireOwned(definition);
        this.write(definition, scope, value);
      },
      update: <TData extends RuntimeDataValue>(
        definition: RuntimeDataDefinition<TData>,
        updater: (current: TData | undefined) => TData,
      ) => {
        requireOwned(definition);
        const next = updater(this.read(definition, scope));
        this.write(definition, scope, next);
        return cloneData(next);
      },
      clear: <TData extends RuntimeDataValue>(definition: RuntimeDataDefinition<TData>) => {
        requireOwned(definition);
        this.clear(definition, scope);
      },
      subscribe: <TData extends RuntimeDataValue>(
        definition: RuntimeDataDefinition<TData>,
        listener: RuntimeDataListener<TData>,
      ) => {
        requireOwned(definition);
        return this.subscribe(definition, scope, listener);
      },
    });
  }

  private requireScope(scope: RuntimeScopeToken): void {
    this.requireActive();
    if (!this.knownScopes.has(scope) || !this.scopeData.has(scope)) {
      throw new Error('Runtime Scope Token 无效或已经释放。');
    }
  }

  private requireActive(): void {
    if (this.disposed) throw new Error('RuntimeDataStore 已释放。');
  }

  private requireDefinition<TData extends RuntimeDataValue>(
    definition: RuntimeDataDefinition<TData>,
    scope: RuntimeScopeToken,
  ): void {
    this.requireScope(scope);
    if (this.definitions.get(definition.key) !== definition) {
      throw new Error(`Runtime 数据“${definition.key}”尚未注册。`);
    }
    if (definition.scope !== scope.address.kind) {
      throw new Error(`Runtime 数据“${definition.key}”需要 ${definition.scope} Scope，不能用于 ${scope.address.kind} Scope。`);
    }
  }

  private read<TData extends RuntimeDataValue>(
    definition: RuntimeDataDefinition<TData>,
    scope: RuntimeScopeToken,
  ): TData | undefined {
    this.requireDefinition(definition, scope);
    const value = this.scopeData.get(scope)!.get(definition.key);
    return value === undefined ? undefined : cloneData(value as TData);
  }

  private write<TData extends RuntimeDataValue>(
    definition: RuntimeDataDefinition<TData>,
    scope: RuntimeScopeToken,
    value: TData,
  ): void {
    this.requireDefinition(definition, scope);
    if (!isRuntimeDataValue(value) || (definition.validate && !definition.validate(value))) {
      throw new TypeError(`Runtime 数据“${definition.key}”不符合浅数据定义。`);
    }
    const stored = this.scopeData.get(scope)!;
    const previous = stored.get(definition.key);
    const current = cloneData(value);
    stored.set(definition.key, current);
    this.emit(definition, scope, previous, current);
  }

  private clear<TData extends RuntimeDataValue>(
    definition: RuntimeDataDefinition<TData>,
    scope: RuntimeScopeToken,
  ): void {
    this.requireDefinition(definition, scope);
    const stored = this.scopeData.get(scope)!;
    const previous = stored.get(definition.key);
    if (previous === undefined) return;
    stored.delete(definition.key);
    this.emit(definition, scope, previous, undefined);
  }

  private subscribe<TData extends RuntimeDataValue>(
    definition: RuntimeDataDefinition<TData>,
    scope: RuntimeScopeToken,
    listener: RuntimeDataListener<TData>,
  ): () => void {
    this.requireDefinition(definition, scope);
    const entry: RuntimeListenerEntry = {
      dataKey: definition.key,
      scope,
      listener: (change) => listener(change as RuntimeDataChange<TData>),
    };
    this.listeners.add(entry);
    return () => this.listeners.delete(entry);
  }

  private emit<TData extends RuntimeDataValue>(
    definition: RuntimeDataDefinition<TData>,
    scope: RuntimeScopeToken,
    previous: RuntimeDataValue | undefined,
    current: RuntimeDataValue | undefined,
  ): void {
    const change: RuntimeDataChange = {
      moduleId: definition.moduleId,
      dataKey: definition.key,
      scope,
      previous: previous === undefined ? undefined : cloneData(previous),
      current: current === undefined ? undefined : cloneData(current),
    };
    this.listeners.forEach((entry) => {
      if (entry.dataKey === definition.key && entry.scope === scope) entry.listener(change);
    });
  }

  private inspect(): readonly RuntimeDataInspection[] {
    const result: RuntimeDataInspection[] = [];
    this.scopeData.forEach((stored, scope) => {
      stored.forEach((value, dataKey) => {
        const definition = this.definitions.get(dataKey);
        if (!definition) return;
        const redacted = definition.visibility === 'private';
        result.push({
          moduleId: definition.moduleId,
          dataKey,
          scope: { ...scope.address },
          visibility: definition.visibility,
          persistence: definition.persistence,
          version: definition.version,
          redacted,
          value: redacted ? null : cloneData(value),
        });
      });
    });
    return result.sort((left, right) => {
      const leftScope = `${left.scope.kind}:${left.scope.key}`;
      const rightScope = `${right.scope.kind}:${right.scope.key}`;
      return leftScope.localeCompare(rightScope) || left.dataKey.localeCompare(right.dataKey);
    });
  }
}

export const createRuntimeDataStore = (): RuntimeDataStore => new RuntimeDataStore();