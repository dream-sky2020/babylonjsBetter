import type { IEntity, IEntityContainer } from '@/core/entity';
import type { WorldPreset, WorldPresetLibrary } from './worldPreset.types';

const requireNonEmptyString = (value: unknown, label: string): string => {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${label}必须是非空字符串。`);
  return value.trim();
};

export const parseWorldPresetLibrary = (value: unknown): WorldPresetLibrary => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('世界预设配置必须是对象。');
  }
  const result: WorldPresetLibrary = {};
  Object.entries(value).forEach(([key, candidate]) => {
    if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) {
      throw new Error(`世界预设“${key}”必须是对象。`);
    }
    const source = candidate as Partial<WorldPreset>;
    const presetKey = requireNonEmptyString(source.presetKey, `世界预设“${key}”的 presetKey`);
    if (presetKey !== key) throw new Error(`世界预设“${key}”的 presetKey 不一致。`);
    if (!source.data || typeof source.data !== 'object' || Array.isArray(source.data)) {
      throw new Error(`世界预设“${key}”的 data 必须是 Entity 容器。`);
    }
    const entities = (source.data as Partial<IEntityContainer>).entities;
    if (!Array.isArray(entities)) throw new Error(`世界预设“${key}”的 data.entities 必须是数组。`);
    entities.forEach((entity, index) => {
      if (!entity || typeof entity !== 'object' || Array.isArray(entity)) {
        throw new Error(`世界预设“${key}”的第 ${index + 1} 个 Entity 无效。`);
      }
      const sourceEntity = entity as Partial<IEntity>;
      requireNonEmptyString(sourceEntity.id, `世界预设“${key}”第 ${index + 1} 个 Entity 的 id`);
      requireNonEmptyString(sourceEntity.entityType, `世界预设“${key}”第 ${index + 1} 个 Entity 的 entityType`);
      if (!Array.isArray(sourceEntity.components)) {
        throw new Error(`世界预设“${key}”第 ${index + 1} 个 Entity 的 components 必须是数组。`);
      }
    });
    result[key] = {
      presetKey,
      name: requireNonEmptyString(source.name, `世界预设“${key}”的 name`),
      data: source.data as IEntityContainer,
    };
  });
  if (!Object.keys(result).length) throw new Error('配置中没有可用世界预设。');
  return result;
};
