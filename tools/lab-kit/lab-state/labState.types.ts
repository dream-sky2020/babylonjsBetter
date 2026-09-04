export type LabStateJsonPrimitive = string | number | boolean | null;
export type LabStateJsonValue =
  | LabStateJsonPrimitive
  | readonly LabStateJsonValue[]
  | { readonly [key: string]: LabStateJsonValue };

export type LabStateSnapshotEntry = {
  readonly version: number;
  readonly data: LabStateJsonValue;
};

export type LabStateSnapshot = {
  readonly format: 'lab-state';
  readonly version: 1;
  readonly createdAt: string;
  readonly modules: Readonly<Record<string, Readonly<Record<string, LabStateSnapshotEntry>>>>;
};

export type LabStateInspection = {
  readonly moduleId: string;
  readonly key: string;
  readonly version: number;
  readonly persistent: boolean;
  readonly value: LabStateJsonValue;
};

export type LabStateSaveDefinition<TLive, TSaved extends LabStateJsonValue> = {
  serialize(value: TLive): TSaved;
  /** 必须完成校验，并可根据 savedVersion 返回迁移后的当前版本数据。 */
  validate(saved: unknown, savedVersion: number): TSaved;
  /** 恢复逻辑归模块所有，并且必须原地修改，以保持模块与 LabState 共用同一个引用。 */
  restore(current: TLive, saved: TSaved): void;
  /** 所有引用均完成原地恢复后执行；用于重建依赖该状态的场景等派生资源。 */
  afterRestore?(current: TLive): void | Promise<void>;
};

export type LabStateReferenceOptions<TLive, TSaved extends LabStateJsonValue = never> = {
  readonly moduleId: string;
  readonly key: string;
  readonly version: number;
  readonly value: TLive;
  /** 返回供 Debug UI 使用的可序列化视图，不暴露原始引用。 */
  readonly inspect: (value: TLive) => LabStateJsonValue;
  readonly save?: LabStateSaveDefinition<TLive, TSaved>;
};

export type LabStateRegistration<TLive> = {
  readonly moduleId: string;
  readonly key: string;
  readonly current: TLive;
  /** 模块替换自己的引用时，同步更新 LabState 中的引用并返回 next。 */
  replace(next: TLive): TLive;
  /** 高频原地修改无需调用；需要主动刷新 Debug 时调用。 */
  markChanged(): void;
  unregister(): void;
};

export type LabStateListener = () => void;
