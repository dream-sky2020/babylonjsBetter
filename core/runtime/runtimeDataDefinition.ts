import type {
  RuntimeDataPersistence,
  RuntimeDataValue,
  RuntimeDataVisibility,
  RuntimeFlatRecord,
  RuntimeModuleId,
  RuntimeScalar,
  RuntimeScopeKind,
} from './runtime.types';

export type RuntimeDataDefinition<TValue extends RuntimeDataValue = RuntimeDataValue> = {
  readonly key: string;
  readonly moduleId: RuntimeModuleId;
  readonly scope: RuntimeScopeKind;
  readonly visibility: RuntimeDataVisibility;
  readonly persistence: RuntimeDataPersistence;
  readonly version: number;
  readonly createDefault?: () => TValue;
  readonly validate?: (value: unknown) => value is TValue;
};

const requireName = (label: string, value: string): string => {
  const normalized = value.trim();
  if (!normalized) throw new Error(`${label} 不能为空。`);
  return normalized;
};

export const defineRuntimeData = <TValue extends RuntimeDataValue>(
  definition: RuntimeDataDefinition<TValue>,
): RuntimeDataDefinition<TValue> => {
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

export const isRuntimeScalar = (value: unknown): value is RuntimeScalar => (
  value === null
  || typeof value === 'string'
  || typeof value === 'boolean'
  || (typeof value === 'number' && Number.isFinite(value))
);

export const isRuntimeFlatRecord = (value: unknown): value is RuntimeFlatRecord => {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return (prototype === Object.prototype || prototype === null)
    && Object.values(value).every(isRuntimeScalar);
};

export const isRuntimeDataValue = (value: unknown): value is RuntimeDataValue => {
  if (isRuntimeScalar(value) || isRuntimeFlatRecord(value)) return true;
  if (!Array.isArray(value)) return false;
  if (value.length === 0) return true;
  return value.every(isRuntimeScalar) || value.every(isRuntimeFlatRecord);
};