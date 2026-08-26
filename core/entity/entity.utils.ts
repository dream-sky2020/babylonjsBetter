import type { IComponent, IEntity, IEntityContainer } from './entity.types';

export const createEntityDataId = (prefix: string): string => {
  const randomId = globalThis.crypto?.randomUUID?.();
  return randomId ? `${prefix}:${randomId}` : `${prefix}:${Date.now()}:${Math.random().toString(36).slice(2)}`;
};

export const createEntity = (name = '新实体', id = createEntityDataId('entity')): IEntity => ({
  id,
  name,
  enabled: true,
  components: [],
});

export const createEntityContainer = (...entities: IEntity[]): IEntityContainer => ({ entities });

export const isEntityContainer = (value: unknown): value is IEntityContainer => (
  !!value && typeof value === 'object' && Array.isArray((value as IEntityContainer).entities)
);

/** 将旧 data.components 容器无损包进一个 Entity，供存档和旧地图渐进迁移。 */
export const normalizeEntityContainer = (
  value: unknown,
  fallbackEntityId: string,
  fallbackName = '地图实体',
): IEntityContainer => {
  if (isEntityContainer(value)) return value;
  const record = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  const legacyComponents = Array.isArray(record.components) ? record.components : [];
  const components = legacyComponents
    .filter((component): component is Record<string, unknown> => !!component && typeof component === 'object')
    .map((component, index): IComponent => ({
      ...component,
      id: typeof component.id === 'string' ? component.id : `${fallbackEntityId}:component:${index}`,
      type: typeof component.type === 'string' ? component.type : 'unknown',
      version: typeof component.version === 'number' ? component.version : 1,
    }));
  const legacyData = Object.fromEntries(Object.entries(record).filter(([key]) => key !== 'components'));
  return createEntityContainer({
    id: fallbackEntityId,
    name: fallbackName,
    enabled: true,
    components,
    ...(Object.keys(legacyData).length > 0 ? {
      components: [{ id: `${fallbackEntityId}:legacy`, type: 'legacy-data', version: 1, data: legacyData }, ...components],
    } : {}),
  });
};

export const getComponents = <T extends IComponent>(entity: IEntity, type: T['type']): T[] => (
  entity.components.filter((component) => component.type === type) as T[]
);
