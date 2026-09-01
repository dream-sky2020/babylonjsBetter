export type RuntimeModuleId = string;

export type RuntimeDataVisibility = 'private' | 'public';
export type RuntimeDataPersistence = 'none' | 'full' | 'delta';
export type RuntimeScopeKind = 'game' | 'world' | 'dungeon' | 'session';

export type RuntimeScalar = string | number | boolean | null;
export type RuntimeFlatRecord = Readonly<Record<string, RuntimeScalar>>;
export type RuntimeScalarArray = readonly RuntimeScalar[];
export type RuntimeFlatRecordArray = readonly RuntimeFlatRecord[];
export type RuntimeDataValue = RuntimeScalar | RuntimeFlatRecord | RuntimeScalarArray | RuntimeFlatRecordArray;

export type RuntimeScopeAddress = {
  readonly kind: RuntimeScopeKind;
  readonly key: string;
};

declare const runtimeScopeTokenBrand: unique symbol;

export type RuntimeScopeToken = {
  readonly address: RuntimeScopeAddress;
  readonly [runtimeScopeTokenBrand]: true;
};

export type RuntimeDataChange<TValue extends RuntimeDataValue = RuntimeDataValue> = {
  readonly moduleId: RuntimeModuleId;
  readonly dataKey: string;
  readonly scope: RuntimeScopeToken;
  /** undefined 表示此前不存在；null 是合法 RuntimeScalar。 */
  readonly previous: TValue | undefined;
  /** undefined 表示已经删除；null 是合法 RuntimeScalar。 */
  readonly current: TValue | undefined;
};

export type RuntimeDataListener<TValue extends RuntimeDataValue = RuntimeDataValue> = (
  change: RuntimeDataChange<TValue>,
) => void;

export type RuntimeDataInspection = {
  readonly moduleId: RuntimeModuleId;
  readonly dataKey: string;
  readonly scope: RuntimeScopeAddress;
  readonly visibility: RuntimeDataVisibility;
  readonly persistence: RuntimeDataPersistence;
  readonly version: number;
  readonly redacted: boolean;
  /** Private 数据使用 null 脱敏；redacted 用于区分真实 null。 */
  readonly value: RuntimeDataValue | null;
};