import type { IEntity, IEntityContainer } from '../entity/entity.types.ts';
import type { DungeonMapDirection } from '../map/dungeonMap.types.ts';
import {
  DUNGEON_MAP_DIRECTION_ORDER,
  type DungeonMapDocumentComponent,
  type DungeonMapDocumentEdge,
  type DungeonMapDocumentEntity,
  type DungeonMapDocumentPoint,
  type DungeonMapDocumentSide,
  type DungeonMapDocumentV2,
  type DungeonMapSpatialAttachmentComponent,
  type DungeonMapSpatialTarget,
} from './dungeonMapDocument.types.ts';

export const dungeonMapSpatialTargetKey = (target: DungeonMapSpatialTarget): string => {
  if (target.kind === 'map') return 'map';
  if (target.kind === 'tile') return `tile:${target.tileId}`;
  if (target.kind === 'side') return `side:${target.sideId}`;
  if (target.kind === 'edge') return `edge:${target.edgeId}`;
  return `point:${target.pointId}`;
};

export type DungeonMapDocumentIndexes = {
  entityById: ReadonlyMap<string, DungeonMapDocumentEntity>;
  componentById: ReadonlyMap<string, DungeonMapDocumentComponent>;
  componentsByEntity: ReadonlyMap<string, ReadonlyMap<string, readonly DungeonMapDocumentComponent[]>>;
  entityIdsBySpatialTarget: ReadonlyMap<string, readonly string[]>;
  tileIndexById: ReadonlyMap<string, number>;
  sideById: ReadonlyMap<string, DungeonMapDocumentSide>;
  edgeById: ReadonlyMap<string, DungeonMapDocumentEdge>;
  pointById: ReadonlyMap<string, DungeonMapDocumentPoint>;
};

export const createDungeonMapDocumentIndexes = (
  document: DungeonMapDocumentV2,
): DungeonMapDocumentIndexes => {
  const entityById = new Map(document.entities.map((entity) => [entity.id, entity]));
  const componentById = new Map<string, DungeonMapDocumentComponent>();
  const componentsByEntity = new Map<string, Map<string, DungeonMapDocumentComponent[]>>();
  Object.values(document.components).flat().forEach((component) => {
    componentById.set(component.id, component);
    const tables = componentsByEntity.get(component.entityId) ?? new Map();
    const components = tables.get(component.type) ?? [];
    components.push(component);
    tables.set(component.type, components);
    componentsByEntity.set(component.entityId, tables);
  });

  const entityIdsBySpatialTarget = new Map<string, string[]>();
  const attachments = (document.components['spatial-attachment'] ?? []) as DungeonMapSpatialAttachmentComponent[];
  attachments.forEach((attachment) => attachment.targets.forEach((target) => {
    const key = dungeonMapSpatialTargetKey(target);
    const entityIds = entityIdsBySpatialTarget.get(key) ?? [];
    if (!entityIds.includes(attachment.entityId)) entityIds.push(attachment.entityId);
    entityIdsBySpatialTarget.set(key, entityIds);
  }));

  return {
    entityById,
    componentById,
    componentsByEntity,
    entityIdsBySpatialTarget,
    tileIndexById: new Map(document.grid.tileIds.map((id, index) => [id, index])),
    sideById: new Map(document.grid.sides.map((side) => [side.id, side])),
    edgeById: new Map(document.grid.edges.map((edge) => [edge.id, edge])),
    pointById: new Map(document.grid.points.map((point) => [point.id, point])),
  };
};

export class DungeonMapDocumentQuery {
  readonly indexes: DungeonMapDocumentIndexes;
  readonly document: DungeonMapDocumentV2;

  constructor(document: DungeonMapDocumentV2) {
    this.document = document;
    this.indexes = createDungeonMapDocumentIndexes(document);
  }

  getEntity(entityId: string): DungeonMapDocumentEntity | undefined {
    return this.indexes.entityById.get(entityId);
  }

  /** 为 Inspector 生成直接来自标准化 ECS 表的只读实体快照。 */
  getEntitySnapshot(entityId: string): IEntity | undefined {
    const entity = this.getEntity(entityId);
    if (!entity) return undefined;
    const components = [...(this.indexes.componentsByEntity.get(entityId)?.values() ?? [])]
      .flat()
      .filter(({ type }) => type !== 'spatial-attachment')
      .map((source) => {
        const { entityId: ownerId, ...component } = source;
        void ownerId;
        return structuredClone(component);
      });
    return { ...structuredClone(entity), components };
  }

  getComponents<T extends DungeonMapDocumentComponent>(entityId: string, componentType: string): readonly T[] {
    return (this.indexes.componentsByEntity.get(entityId)?.get(componentType) ?? []) as readonly T[];
  }

  getEntitiesAt(target: DungeonMapSpatialTarget): readonly DungeonMapDocumentEntity[] {
    return (this.indexes.entityIdsBySpatialTarget.get(dungeonMapSpatialTargetKey(target)) ?? [])
      .map((entityId) => this.indexes.entityById.get(entityId))
      .filter((entity): entity is DungeonMapDocumentEntity => entity !== undefined);
  }

  getContainerAt(target: DungeonMapSpatialTarget): IEntityContainer {
    return {
      entities: this.getEntitiesAt(target)
        .map(({ id }) => this.getEntitySnapshot(id))
        .filter((entity): entity is IEntity => entity !== undefined),
    };
  }

  getTileIdAt(x: number, y: number): string | undefined {
    if (!Number.isInteger(x) || !Number.isInteger(y)
      || x < 0 || y < 0 || x >= this.document.grid.width || y >= this.document.grid.height) return undefined;
    return this.document.grid.tileIds[y * this.document.grid.width + x];
  }

  getSide(tileId: string, direction: DungeonMapDirection): DungeonMapDocumentSide | undefined {
    const tileIndex = this.indexes.tileIndexById.get(tileId);
    const directionIndex = DUNGEON_MAP_DIRECTION_ORDER.indexOf(direction);
    if (tileIndex === undefined || directionIndex < 0) return undefined;
    const sideId = this.document.grid.tileSides[tileIndex]?.[directionIndex];
    return sideId ? this.indexes.sideById.get(sideId) : undefined;
  }

  getEdge(tileId: string, direction: DungeonMapDirection): DungeonMapDocumentEdge | undefined {
    const side = this.getSide(tileId, direction);
    return side ? this.indexes.edgeById.get(side.edgeId) : undefined;
  }

  getNeighborTileId(tileId: string, direction: DungeonMapDirection): string | undefined {
    const side = this.getSide(tileId, direction);
    const edge = side ? this.indexes.edgeById.get(side.edgeId) : undefined;
    if (!side || !edge || edge.sideIds.length !== 2) return undefined;
    const neighborSideId = edge.sideIds[0] === side.id ? edge.sideIds[1] : edge.sideIds[0];
    return this.indexes.sideById.get(neighborSideId)?.tileId;
  }
}
