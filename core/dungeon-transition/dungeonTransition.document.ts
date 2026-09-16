import { getComponents } from '../entity/entity.utils.ts';
import type { IDungeonEntranceComponent } from '../entity/components/dungeon-entrance.component.ts';
import {
  DUNGEON_EXIT_TRIGGERS,
  resolveDungeonExitTriggers,
  type DungeonExitTrigger,
  type IDungeonExitComponent,
} from '../entity/components/dungeon-exit.component.ts';
import type { IEntity } from '../entity/entity.types.ts';
import type {
  DungeonMapDirection,
  DungeonMapEdgeEndpoint,
  DungeonMapValidationIssue,
} from '../map/dungeonMap.types.ts';
import {
  DUNGEON_MAP_DIRECTION_ORDER,
  DungeonMapDocumentQuery,
  type DungeonMapDocumentV2,
  type DungeonMapDocumentLibraryV2,
  type DungeonMapSpatialTarget,
} from '../map-document/index.ts';
import {
  getDungeonRuntimeNeighbor,
  type DungeonRuntimeMap,
} from '../dungeon-runtime/dungeonRuntimeMap.ts';
import type {
  DungeonEntranceBinding,
  DungeonExitBinding,
  DungeonExitLocation,
} from './dungeonTransition.types.ts';

type TilePosition = Readonly<{ tileX: number; tileY: number }>;

const tilePosition = (
  document: DungeonMapDocumentV2,
  query: DungeonMapDocumentQuery,
  tileId: string,
): TilePosition | undefined => {
  const index = query.indexes.tileIndexById.get(tileId);
  return index === undefined ? undefined : {
    tileX: index % document.grid.width,
    tileY: Math.floor(index / document.grid.width),
  };
};

const edgeEndpoints = (
  document: DungeonMapDocumentV2,
  query: DungeonMapDocumentQuery,
  edgeId: string,
): readonly DungeonMapEdgeEndpoint[] => {
  const edge = query.indexes.edgeById.get(edgeId);
  if (!edge) return [];
  return edge.sideIds.flatMap((sideId) => {
    const side = query.indexes.sideById.get(sideId);
    const position = side && tilePosition(document, query, side.tileId);
    return side && position ? [{ x: position.tileX, y: position.tileY, direction: side.direction }] : [];
  });
};

const entityAttachments = (
  query: DungeonMapDocumentQuery,
  entityId: string,
): readonly DungeonMapSpatialTarget[] => query.getComponents(entityId, 'spatial-attachment')
  .flatMap((component) => (component as { targets?: DungeonMapSpatialTarget[] }).targets ?? []);

const enabledComponents = <T extends IDungeonEntranceComponent | IDungeonExitComponent>(
  entity: IEntity,
  type: T['type'],
): T[] => getComponents<T>(entity, type).filter((component) => component.enabled !== false);

const entranceAt = (
  document: DungeonMapDocumentV2,
  query: DungeonMapDocumentQuery,
  entityId: string,
  target: DungeonMapSpatialTarget,
): DungeonEntranceBinding[] => {
  if (target.kind !== 'tile') return [];
  const entity = query.getEntitySnapshot(entityId);
  const position = tilePosition(document, query, target.tileId);
  if (!entity || entity.entityType !== 'dungeon-entrance' || entity.enabled === false || !position) return [];
  return enabledComponents<IDungeonEntranceComponent>(entity, 'dungeon-entrance').map((component) => ({
    entity, component, ...position,
  }));
};

const exitLocation = (
  document: DungeonMapDocumentV2,
  query: DungeonMapDocumentQuery,
  target: DungeonMapSpatialTarget,
): DungeonExitLocation | undefined => {
  if (target.kind === 'tile') {
    const position = tilePosition(document, query, target.tileId);
    return position ? { kind: 'tile', ...position } : undefined;
  }
  if (target.kind === 'side') {
    const side = query.indexes.sideById.get(target.sideId);
    const position = side && tilePosition(document, query, side.tileId);
    return side && position ? {
      kind: 'tile-edge', ...position, direction: side.direction,
      sideId: side.id, edgeId: side.edgeId,
    } : undefined;
  }
  if (target.kind === 'edge') return {
    kind: 'shared-edge', edgeId: target.edgeId,
    sides: edgeEndpoints(document, query, target.edgeId),
  };
  return undefined;
};

const exitAt = (
  query: DungeonMapDocumentQuery,
  target: DungeonMapSpatialTarget,
  location: DungeonExitLocation,
  trigger?: DungeonExitTrigger,
): DungeonExitBinding[] => query.getEntitiesAt(target).flatMap(({ id }) => {
  const entity = query.getEntitySnapshot(id);
  if (!entity || entity.entityType !== 'dungeon-exit' || entity.enabled === false) return [];
  return enabledComponents<IDungeonExitComponent>(entity, 'dungeon-exit')
    .filter((component) => !trigger || resolveDungeonExitTriggers(component).includes(trigger))
    .map((component) => ({ entity, component, location }));
});

const requireSingleExit = (matches: DungeonExitBinding[], description: string): DungeonExitBinding | null => {
  const unique = [...new Map(matches.map((binding) => [
    `${binding.entity.id}\u0000${binding.component.id}`, binding,
  ])).values()];
  if (unique.length > 1) {
    throw new Error(`${description}同时匹配多个地牢出口：${unique.map(({ entity }) => entity.id).join('、')}。`);
  }
  return unique[0] ?? null;
};

export const scanDungeonDocumentEntrances = (
  document: DungeonMapDocumentV2,
): DungeonEntranceBinding[] => {
  const query = new DungeonMapDocumentQuery(document);
  return document.entities.flatMap(({ id }) => entityAttachments(query, id)
    .flatMap((target) => entranceAt(document, query, id, target)));
};

export const scanDungeonDocumentExits = (
  document: DungeonMapDocumentV2,
): DungeonExitBinding[] => {
  const query = new DungeonMapDocumentQuery(document);
  return document.entities.flatMap(({ id }) => {
    const entity = query.getEntitySnapshot(id);
    if (!entity || entity.entityType !== 'dungeon-exit' || entity.enabled === false) return [];
    return entityAttachments(query, id).flatMap((target) => {
      const location = exitLocation(document, query, target);
      return location ? enabledComponents<IDungeonExitComponent>(entity, 'dungeon-exit')
        .map((component) => ({ entity, component, location })) : [];
    });
  });
};

export const findDungeonDocumentEntrance = (
  document: DungeonMapDocumentV2,
  entranceId: string,
): DungeonEntranceBinding => {
  const matches = scanDungeonDocumentEntrances(document)
    .filter(({ component }) => component.entranceId === entranceId);
  if (matches.length === 0) throw new Error(`地图“${document.identity.id}”不存在启用的入口“${entranceId}”。`);
  if (matches.length > 1) throw new Error(`地图“${document.identity.id}”存在多个启用的入口“${entranceId}”。`);
  return matches[0];
};

/** 直接校验 V2 Entity、Component 与空间挂载关系，不生成 V1 容器。 */
export const validateDungeonTransitionDocument = (
  document: DungeonMapDocumentV2,
): DungeonMapValidationIssue[] => {
  const query = new DungeonMapDocumentQuery(document);
  const issues: DungeonMapValidationIssue[] = [];
  const entranceIds = new Map<string, string>();
  document.entities.forEach(({ id }) => {
    const entity = query.getEntitySnapshot(id)!;
    const entrances = getComponents<IDungeonEntranceComponent>(entity, 'dungeon-entrance');
    const exits = getComponents<IDungeonExitComponent>(entity, 'dungeon-exit');
    const targets = entityAttachments(query, id);
    const onlyOnTiles = targets.length > 0 && targets.every(({ kind }) => kind === 'tile');
    const onlyOnExitTargets = targets.length > 0
      && targets.every(({ kind }) => kind === 'tile' || kind === 'side' || kind === 'edge');
    if (entity.entityType === 'dungeon-entrance' && entrances.length !== 1) {
      issues.push({ code: 'invalid-dungeon-entrance-component-count', message: `入口实体“${id}”必须有且只能有一个 dungeon-entrance 组件。` });
    }
    if (entrances.length && (entity.entityType !== 'dungeon-entrance' || !onlyOnTiles)) {
      issues.push({ code: 'invalid-dungeon-entrance-placement', message: `dungeon-entrance 组件“${entrances[0].id}”只能挂载到格子的 dungeon-entrance 实体。` });
    }
    entrances.forEach((component) => {
      const entranceId = typeof component.entranceId === 'string' ? component.entranceId.trim() : '';
      if (!entranceId) {
        issues.push({ code: 'invalid-dungeon-entrance-id', message: `入口实体“${id}”的 entranceId 不能为空。` });
      } else if (entranceIds.has(entranceId)) {
        issues.push({ code: 'duplicate-dungeon-entrance-id', message: `入口 ID“${entranceId}”在地图内重复：${entranceIds.get(entranceId)}、${id}。` });
      } else entranceIds.set(entranceId, id);
      if (!DUNGEON_MAP_DIRECTION_ORDER.includes(component.facing)) {
        issues.push({ code: 'invalid-dungeon-entrance-facing', message: `入口“${entranceId || id}”的 facing 无效。` });
      }
    });
    if (entity.entityType === 'dungeon-exit' && exits.length !== 1) {
      issues.push({ code: 'invalid-dungeon-exit-component-count', message: `出口实体“${id}”必须有且只能有一个 dungeon-exit 组件。` });
    }
    if (exits.length && (entity.entityType !== 'dungeon-exit' || !onlyOnExitTargets)) {
      issues.push({ code: 'invalid-dungeon-exit-placement', message: `dungeon-exit 组件“${exits[0].id}”只能挂载到格子、Side 或 Edge。` });
    }
    exits.forEach((component) => {
      if (typeof component.targetMapPresetKey !== 'string' || !component.targetMapPresetKey.trim()) {
        issues.push({ code: 'invalid-dungeon-exit-target-map', message: `出口实体“${id}”的目标地图预设 Key 不能为空。` });
      }
      if (typeof component.targetEntranceId !== 'string' || !component.targetEntranceId.trim()) {
        issues.push({ code: 'invalid-dungeon-exit-target-entrance', message: `出口实体“${id}”的目标入口 ID 不能为空。` });
      }
      const rawTriggers = component.triggers as unknown;
      const invalidTriggers = Array.isArray(rawTriggers)
        ? rawTriggers.length === 0 || rawTriggers.some((trigger) => !DUNGEON_EXIT_TRIGGERS.includes(trigger))
        : !['enter', 'interact', 'both'].includes(component.activation ?? '');
      if (invalidTriggers) {
        issues.push({ code: 'invalid-dungeon-exit-triggers', message: `出口实体“${id}”的 triggers 无效或为空。` });
      }
      if (resolveDungeonExitTriggers(component).includes('move-attempt')
        && targets.some(({ kind }) => kind === 'tile')) {
        issues.push({ code: 'invalid-dungeon-exit-move-attempt-placement', message: `出口实体“${id}”的 move-attempt 只能用于 Side 或 Edge。` });
      }
    });
  });
  return issues;
};

export const validateDungeonTransitionDocumentLibrary = (
  library: DungeonMapDocumentLibraryV2,
): DungeonMapValidationIssue[] => Object.values(library).flatMap((document) => {
  const presetKey = document.identity.presetKey;
  const issues = validateDungeonTransitionDocument(document).map((issue) => ({
    ...issue,
    message: `地图预设“${presetKey}”：${issue.message}`,
  }));
  scanDungeonDocumentExits(document).forEach(({ entity, component }) => {
    const target = library[component.targetMapPresetKey];
    if (!target) {
      issues.push({
        code: 'missing-dungeon-exit-target-map',
        message: `地图预设“${presetKey}”的出口“${entity.id}”指向不存在的地图预设“${component.targetMapPresetKey}”。`,
      });
      return;
    }
    const matches = scanDungeonDocumentEntrances(target)
      .filter(({ component: entrance }) => entrance.entranceId === component.targetEntranceId);
    if (matches.length !== 1) {
      issues.push({
        code: 'invalid-dungeon-exit-target-entrance',
        message: `地图预设“${presetKey}”的出口“${entity.id}”指向目标地图“${component.targetMapPresetKey}”中 ${matches.length === 0 ? '不存在' : '不唯一'}的入口“${component.targetEntranceId}”。`,
      });
    }
  });
  return issues;
});

const targetAt = (
  map: DungeonRuntimeMap,
  position: TilePosition,
): DungeonMapSpatialTarget | undefined => {
  const tileId = map.topology.tileIds[position.tileY * map.width + position.tileX];
  return tileId ? { kind: 'tile', tileId } : undefined;
};

const sideAt = (
  map: DungeonRuntimeMap,
  position: TilePosition,
  direction: DungeonMapDirection,
): Readonly<{ target: DungeonMapSpatialTarget; location: DungeonExitLocation; edgeId: string }> | undefined => {
  const directionIndex = DUNGEON_MAP_DIRECTION_ORDER.indexOf(direction);
  const tileIndex = position.tileY * map.width + position.tileX;
  const sideIndex = map.topology.sideIndices[tileIndex * 4 + directionIndex];
  const edgeIndex = map.topology.edgeIndices[tileIndex * 4 + directionIndex];
  if (sideIndex < 0 || edgeIndex < 0) return undefined;
  const sideId = map.topology.sideIds[sideIndex];
  const edgeId = map.topology.edgeIds[edgeIndex];
  return {
    target: { kind: 'side', sideId }, edgeId,
    location: { kind: 'tile-edge', ...position, direction, sideId, edgeId },
  };
};

const edgeAt = (
  map: DungeonRuntimeMap,
  edgeId: string,
): Readonly<{ target: DungeonMapSpatialTarget; location: DungeonExitLocation }> => {
  const query = new DungeonMapDocumentQuery(map.document);
  return {
    target: { kind: 'edge', edgeId },
    location: { kind: 'shared-edge', edgeId, sides: edgeEndpoints(map.document, query, edgeId) },
  };
};

const opposite: Readonly<Record<DungeonMapDirection, DungeonMapDirection>> = {
  north: 'south', east: 'west', south: 'north', west: 'east',
};

const movementDirection = (
  map: DungeonRuntimeMap,
  from: TilePosition,
  to: TilePosition,
): DungeonMapDirection | undefined => DUNGEON_MAP_DIRECTION_ORDER.find((direction) => {
  const neighbor = getDungeonRuntimeNeighbor(map, from, direction);
  return neighbor?.tileX === to.tileX && neighbor.tileY === to.tileY;
});

export const findDungeonDocumentExitAfterMovement = (
  map: DungeonRuntimeMap,
  from: TilePosition,
  to: TilePosition,
): DungeonExitBinding | null => {
  const query = new DungeonMapDocumentQuery(map.document);
  const matches: DungeonExitBinding[] = [];
  const destination = targetAt(map, to);
  if (destination) matches.push(...exitAt(query, destination, { kind: 'tile', ...to }, 'enter'));
  const direction = movementDirection(map, from, to);
  if (direction) {
    const leaving = sideAt(map, from, direction);
    const entering = sideAt(map, to, opposite[direction]);
    if (leaving) matches.push(...exitAt(query, leaving.target, leaving.location, 'enter'));
    if (entering) matches.push(...exitAt(query, entering.target, entering.location, 'enter'));
    const edgeId = leaving?.edgeId ?? entering?.edgeId;
    if (edgeId) {
      const edge = edgeAt(map, edgeId);
      matches.push(...exitAt(query, edge.target, edge.location, 'enter'));
    }
  }
  return requireSingleExit(matches, `玩家移动到 (${to.tileX}, ${to.tileY}) 时`);
};

export const findDungeonDocumentExitForInteraction = (
  map: DungeonRuntimeMap,
  position: TilePosition,
  facing: DungeonMapDirection,
): DungeonExitBinding | null => {
  const query = new DungeonMapDocumentQuery(map.document);
  const matches: DungeonExitBinding[] = [];
  const tile = targetAt(map, position);
  if (tile) matches.push(...exitAt(query, tile, { kind: 'tile', ...position }, 'interact'));
  const side = sideAt(map, position, facing);
  if (side) {
    matches.push(...exitAt(query, side.target, side.location, 'interact'));
    const edge = edgeAt(map, side.edgeId);
    matches.push(...exitAt(query, edge.target, edge.location, 'interact'));
  }
  return requireSingleExit(matches, `玩家在 (${position.tileX}, ${position.tileY}) 面向 ${facing} 交互时`);
};

export const findDungeonDocumentExitForMoveAttempt = (
  map: DungeonRuntimeMap,
  position: TilePosition,
  direction: DungeonMapDirection,
): DungeonExitBinding | null => {
  const query = new DungeonMapDocumentQuery(map.document);
  const matches: DungeonExitBinding[] = [];
  const side = sideAt(map, position, direction);
  if (side) {
    matches.push(...exitAt(query, side.target, side.location, 'move-attempt'));
    const edge = edgeAt(map, side.edgeId);
    matches.push(...exitAt(query, edge.target, edge.location, 'move-attempt'));
  }
  return requireSingleExit(matches, `玩家在 (${position.tileX}, ${position.tileY}) 尝试向 ${direction} 移动时`);
};
