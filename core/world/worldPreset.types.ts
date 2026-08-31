import type { IEntityContainer } from '@/core/entity';

export type WorldPreset = {
  presetKey: string;
  name: string;
  /** 世界唯一的数据容器；其内容由注册的 Entity/Component 定义扩展。 */
  data: IEntityContainer;
};

export type WorldPresetLibrary = Record<string, WorldPreset>;
