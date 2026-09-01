export type RuntimeModuleId = string;

export type RuntimeDataVisibility = 'private' | 'public';
export type RuntimeDataPersistence = 'none' | 'full' | 'delta';
export type RuntimeScopeKind = 'game' | 'world' | 'dungeon' | 'session';

export type RuntimeDataScalar = string | number | boolean | null;
export type RuntimeDataField = RuntimeDataScalar | readonly RuntimeDataScalar[];
export type RuntimeShallowData = Readonly<Record<string, RuntimeDataField>>;

export type RuntimeScopeAddress = {
  readonly kind: RuntimeScopeKind;
  readonly key: string;
};

declare const runtimeScopeTokenBrand: unique symbol;

export type RuntimeScopeToken = {
  readonly address: RuntimeScopeAddress;
  readonly [runtimeScopeTokenBrand]: true;
};

export type RuntimeDataChange<TData extends RuntimeShallowData = RuntimeShallowData> = {
  readonly moduleId: RuntimeModuleId;
  readonly dataKey: string;
  readonly scope: RuntimeScopeToken;
  readonly previous: TData | null;
  readonly current: TData | null;
};

export type RuntimeDataListener<TData extends RuntimeShallowData = RuntimeShallowData> = (
  change: RuntimeDataChange<TData>,
) => void;

export type RuntimeDataInspection = {
  readonly moduleId: RuntimeModuleId;
  readonly dataKey: string;
  readonly scope: RuntimeScopeAddress;
  readonly visibility: RuntimeDataVisibility;
  readonly persistence: RuntimeDataPersistence;
  readonly version: number;
  readonly redacted: boolean;
  readonly value: RuntimeShallowData | null;
};