import type {
  RuntimeDataPersistence,
  RuntimeDataVisibility,
  RuntimeModuleId,
  RuntimeScopeKind,
  RuntimeShallowData,
} from './runtime.types';

export type RuntimeDataDefinition<TData extends RuntimeShallowData = RuntimeShallowData> = {
  readonly key: string;
  readonly moduleId: RuntimeModuleId;
  readonly scope: RuntimeScopeKind;
  readonly visibility: RuntimeDataVisibility;
  readonly persistence: RuntimeDataPersistence;
  readonly version: number;
  readonly createDefault?: () => TData;
  readonly validate?: (value: unknown) => value is TData;
};

const requireName = (label: string, value: string): string => {
  const normalized = value.trim();
  if (!normalized) throw new Error(`${label} 不能为空。`);
  return normalized;
};

export const defineRuntimeData = <TData extends RuntimeShallowData>(
  definition: RuntimeDataDefinition<TData>,
): RuntimeDataDefinition<TData> => {
  const version = definition.version;
  if (!Number.isSafeInteger(version) || version < 1) {
    throw new RangeError('Runtime 数据版本必须是大于等于 1 的安全整数。');
  }
  return Object.freeze({
    ...definition,
    key: requireName('Runtime Data Key', definition.key),
    moduleId: requireName('Runtime Module ID', definition.moduleId),
  });
};

export const isRuntimeShallowData = (value: unknown): value is RuntimeShallowData => {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) return false;
  return Object.values(value).every((field) => {
    if (field === null || typeof field === 'string' || typeof field === 'boolean') return true;
    if (typeof field === 'number') return Number.isFinite(field);
    return Array.isArray(field) && field.every((item) => (
      item === null
      || typeof item === 'string'
      || typeof item === 'boolean'
      || (typeof item === 'number' && Number.isFinite(item))
    ));
  });
};