import {
  getComponents,
  isEntityContainer,
} from '../entity/entity.utils.ts';
import type { IDungeonEntranceComponent } from '../entity/components/dungeon-entrance.component.ts';
import type { IDungeonExitComponent } from '../entity/components/dungeon-exit.component.ts';
import type { IEntity, IEntityContainer } from '../entity/entity.types.ts';
import {
  getDungeonMapEdge,
  getDungeonMapTile,
  getDungeonMapTraversalEdges,
} from '../map/dungeonMap.ts';
import type {
  DungeonMapData,
  DungeonMapDirection,
  DungeonMapPresetLibrary,
  DungeonMapValidationIssue,
} from '../map/dungeonMap.types.ts';
import type {
  DungeonEntranceBinding,
  DungeonExitBinding,
  DungeonExitLocation,
  DungeonTransitionResult,
} from './dungeonTransition.types';

type LocatedContainer = Readonly<{
  kind: 'map' | 'tile' | 'tile-edge' | 'shared-edge' | 'shared-point';
  data: IEntityContainer | undefined;
  location?: DungeonExitLocation;
  tileX?: number;
  tileY?: number;
}>;

const DIRECTIONS: readonly DungeonMapDirection[] = ['north', 'east', 'south', 'west'];

const locatedContainers = (map: DungeonMapData): LocatedContainer[] => {
  const result: LocatedContainer[] = [{ kind: 'map', data: isEntityContainer(map.data) ? map.data : undefined }];
  map.tiles.forEach((tile) => {
    result.push({
      kind: 'tile', data: isEntityContainer(tile.data) ? tile.data : undefined,
      tileX: tile.x, tileY: tile.y,
      location: { kind: 'tile', tileX: tile.x, tileY: tile.y },
    });
    DIRECTIONS.forEach((direction) => {
      const edge = tile.edges[direction];
      result.push({
        kind: 'tile-edge', data: isEntityContainer(edge.data) ? edge.data : undefined,
        location: { kind: 'tile-edge', tileX: tile.x, tileY: tile.y, direction, edge },
      });
    });
  });
  (map.sharedEdges ?? []).forEach(({ sides, edge }) => result.push({
    kind: 'shared-edge', data: isEntityContainer(edge.data) ? edge.data : undefined,
    location: { kind: 'shared-edge', sides, edge },
  }));
  (map.sharedPoints ?? []).forEach(({ point }) => result.push({
    kind: 'shared-point', data: isEntityContainer(point.data) ? point.data : undefined,
  }));
  return result;
};

const enabledComponents = <T extends IDungeonEntranceComponent | IDungeonExitComponent>(
  entity: IEntity,
  type: T['type'],
): T[] => getComponents<T>(entity, type).filter((component) => component.enabled !== false);

export const scanDungeonEntrances = (map: DungeonMapData): DungeonEntranceBinding[] => locatedContainers(map)
  .filter((container) => container.kind === 'tile' && container.data)
  .flatMap((container) => container.data!.entities
    .filter((entity) => entity.entityType === 'dungeon-entrance' && entity.enabled !== false)
    .flatMap((entity) => enabledComponents<IDungeonEntranceComponent>(entity, 'dungeon-entrance')
      .map((component) => ({
        entity, component,
        tileX: container.tileX!, tileY: container.tileY!,
      }))));

export const scanDungeonExits = (map: DungeonMapData): DungeonExitBinding[] => locatedContainers(map)
  .filter((container) => !!container.location && container.data)
  .flatMap((container) => container.data!.entities
    .filter((entity) => entity.entityType === 'dungeon-exit' && entity.enabled !== false)
    .flatMap((entity) => enabledComponents<IDungeonExitComponent>(entity, 'dungeon-exit')
      .map((component) => ({ entity, component, location: container.location! }))));

export const findDungeonEntrance = (map: DungeonMapData, entranceId: string): DungeonEntranceBinding => {
  const matches = scanDungeonEntrances(map).filter(({ component }) => component.entranceId === entranceId);
  if (matches.length === 0) throw new Error(`地图“${map.id}”不存在启用的入口“${entranceId}”。`);
  if (matches.length > 1) throw new Error(`地图“${map.id}”存在多个启用的入口“${entranceId}”。`);
  return matches[0];
};

const requireSingleExit = (matches: DungeonExitBinding[], description: string): DungeonExitBinding | null => {
  const unique = [...new Map(matches.map((binding) => [
    `${binding.entity.id}\u0000${binding.component.id}`, binding,
  ])).values()];
  if (unique.length > 1) throw new Error(`${description}同时匹配多个地牢出口：${unique.map(({ entity }) => entity.id).join('、')}。`);
  return unique[0] ?? null;
};

const exitsInData = (
  data: unknown,
  activation: IDungeonExitComponent['activation'],
  location: DungeonExitLocation,
): DungeonExitBinding[] => !isEntityContainer(data) ? [] : data.entities
  .filter((entity) => entity.entityType === 'dungeon-exit' && entity.enabled !== false)
  .flatMap((entity) => enabledComponents<IDungeonExitComponent>(entity, 'dungeon-exit')
    .filter((component) => component.activation === activation)
    .map((component) => ({ entity, component, location })));

const directionBetween = (
  map: DungeonMapData,
  from: Readonly<{ tileX: number; tileY: number }>,
  to: Readonly<{ tileX: number; tileY: number }>,
): DungeonMapDirection | null => {
  for (const direction of DIRECTIONS) {
    const traversal = getDungeonMapTraversalEdges(map, from.tileX, from.tileY, direction);
    if (traversal?.entering.tileX === to.tileX && traversal.entering.tileY === to.tileY) return direction;
  }
  return null;
};

export const findDungeonExitAfterMovement = (
  map: DungeonMapData,
  from: Readonly<{ tileX: number; tileY: number }>,
  to: Readonly<{ tileX: number; tileY: number }>,
): DungeonExitBinding | null => {
  const destinationTile = getDungeonMapTile(map, to.tileX, to.tileY);
  const matches = destinationTile
    ? exitsInData(destinationTile.data, 'enter', { kind: 'tile', tileX: to.tileX, tileY: to.tileY })
    : [];
  const direction = directionBetween(map, from, to);
  const traversal = direction ? getDungeonMapTraversalEdges(map, from.tileX, from.tileY, direction) : undefined;
  if (traversal) {
    for (const candidate of [traversal.leaving, traversal.entering]) {
      const edge = candidate.edge;
      const shared = map.sharedEdges?.find(({ edge: sharedEdge }) => sharedEdge === edge);
      const location: DungeonExitLocation = shared
        ? { kind: 'shared-edge', sides: shared.sides, edge }
        : { kind: 'tile-edge', tileX: candidate.tileX, tileY: candidate.tileY, direction: candidate.direction, edge };
      matches.push(...exitsInData(edge.data, 'enter', location));
    }
  }
  return requireSingleExit(matches, `玩家移动到 (${to.tileX}, ${to.tileY}) 时`);
};

export const findDungeonExitForInteraction = (
  map: DungeonMapData,
  position: Readonly<{ tileX: number; tileY: number }>,
  facing: DungeonMapDirection,
): DungeonExitBinding | null => {
  const tile = getDungeonMapTile(map, position.tileX, position.tileY);
  const matches = tile
    ? exitsInData(tile.data, 'interact', { kind: 'tile', tileX: position.tileX, tileY: position.tileY })
    : [];
  const edge = getDungeonMapEdge(map, position.tileX, position.tileY, facing);
  if (edge) {
    const shared = map.sharedEdges?.find(({ edge: sharedEdge }) => sharedEdge === edge);
    const location: DungeonExitLocation = shared
      ? { kind: 'shared-edge', sides: shared.sides, edge }
      : { kind: 'tile-edge', tileX: position.tileX, tileY: position.tileY, direction: facing, edge };
    matches.push(...exitsInData(edge.data, 'interact', location));
  }
  return requireSingleExit(matches, `玩家在 (${position.tileX}, ${position.tileY}) 面向 ${facing} 交互时`);
};

export const validateDungeonTransitionMap = (map: DungeonMapData): DungeonMapValidationIssue[] => {
  const issues: DungeonMapValidationIssue[] = [];
  const entranceIds = new Map<string, string>();
  locatedContainers(map).forEach((container) => {
    container.data?.entities.forEach((entity) => {
      const entrances = getComponents<IDungeonEntranceComponent>(entity, 'dungeon-entrance');
      const exits = getComponents<IDungeonExitComponent>(entity, 'dungeon-exit');
      if (entity.entityType === 'dungeon-entrance' && entrances.length !== 1) {
        issues.push({ code: 'invalid-dungeon-entrance-component-count', message: `入口实体“${entity.id}”必须有且只能有一个 dungeon-entrance 组件。` });
      }
      if (entrances.length && (entity.entityType !== 'dungeon-entrance' || container.kind !== 'tile')) {
        issues.push({ code: 'invalid-dungeon-entrance-placement', message: `dungeon-entrance 组件“${entrances[0].id}”只能位于格子的 dungeon-entrance 实体。` });
      }
      entrances.forEach((component) => {
        const id = typeof component.entranceId === 'string' ? component.entranceId.trim() : '';
        if (!id) issues.push({ code: 'invalid-dungeon-entrance-id', message: `入口实体“${entity.id}”的 entranceId 不能为空。` });
        else if (entranceIds.has(id)) issues.push({ code: 'duplicate-dungeon-entrance-id', message: `入口 ID“${id}”在地图内重复：${entranceIds.get(id)}、${entity.id}。` });
        else entranceIds.set(id, entity.id);
        if (!DIRECTIONS.includes(component.facing)) issues.push({ code: 'invalid-dungeon-entrance-facing', message: `入口“${id || entity.id}”的 facing 无效。` });
      });
      if (entity.entityType === 'dungeon-exit' && exits.length !== 1) {
        issues.push({ code: 'invalid-dungeon-exit-component-count', message: `出口实体“${entity.id}”必须有且只能有一个 dungeon-exit 组件。` });
      }
      if (exits.length && (entity.entityType !== 'dungeon-exit'
        || !['tile', 'tile-edge', 'shared-edge'].includes(container.kind))) {
        issues.push({ code: 'invalid-dungeon-exit-placement', message: `dungeon-exit 组件“${exits[0].id}”只能位于格子、单向边或公用边的 dungeon-exit 实体。` });
      }
      exits.forEach((component) => {
        if (typeof component.targetMapPresetKey !== 'string' || !component.targetMapPresetKey.trim()) {
          issues.push({ code: 'invalid-dungeon-exit-target-map', message: `出口实体“${entity.id}”的目标地图预设 Key 不能为空。` });
        }
        if (typeof component.targetEntranceId !== 'string' || !component.targetEntranceId.trim()) {
          issues.push({ code: 'invalid-dungeon-exit-target-entrance', message: `出口实体“${entity.id}”的目标入口 ID 不能为空。` });
        }
        if (component.activation !== 'enter' && component.activation !== 'interact') {
          issues.push({ code: 'invalid-dungeon-exit-activation', message: `出口实体“${entity.id}”的 activation 无效。` });
        }
      });
    });
  });
  return issues;
};

export const validateDungeonTransitionLibrary = (
  library: DungeonMapPresetLibrary,
): DungeonMapValidationIssue[] => Object.values(library).flatMap((preset) => {
  const issues = validateDungeonTransitionMap(preset.map).map((issue) => ({
    ...issue, message: `地图预设“${preset.presetKey}”：${issue.message}`,
  }));
  scanDungeonExits(preset.map).forEach(({ entity, component }) => {
    const target = library[component.targetMapPresetKey];
    if (!target) {
      issues.push({ code: 'missing-dungeon-exit-target-map', message: `地图预设“${preset.presetKey}”的出口“${entity.id}”指向不存在的地图预设“${component.targetMapPresetKey}”。` });
      return;
    }
    const entranceMatches = scanDungeonEntrances(target.map)
      .filter(({ component: entrance }) => entrance.entranceId === component.targetEntranceId);
    if (entranceMatches.length !== 1) {
      issues.push({
        code: 'invalid-dungeon-exit-target-entrance',
        message: `地图预设“${preset.presetKey}”的出口“${entity.id}”指向目标地图“${component.targetMapPresetKey}”中 ${entranceMatches.length === 0 ? '不存在' : '不唯一'}的入口“${component.targetEntranceId}”。`,
      });
    }
  });
  return issues;
});

export type DungeonTransitionAdapter = Readonly<{
  getCurrentPresetKey: () => string;
  /** Loader 必须在公开目标地图前完成入口落点，保证切换对消费者是原子的。 */
  switchDungeon: (presetKey: string, entranceId: string) => Promise<boolean>;
}>;

export const createDungeonTransitionController = (adapter: DungeonTransitionAdapter) => {
  let transitioning = false;
  return {
    get transitioning() { return transitioning; },
    async transition(exit: DungeonExitBinding): Promise<DungeonTransitionResult> {
      const sourcePresetKey = adapter.getCurrentPresetKey();
      const { targetMapPresetKey, targetEntranceId } = exit.component;
      if (transitioning) return {
        transitioned: false, sourcePresetKey, targetPresetKey: targetMapPresetKey,
        targetEntranceId, reason: 'busy' as const,
      };
      transitioning = true;
      try {
        const loaded = await adapter.switchDungeon(targetMapPresetKey, targetEntranceId);
        if (!loaded) return {
          transitioned: false, sourcePresetKey, targetPresetKey: targetMapPresetKey,
          targetEntranceId, reason: 'switch-rejected' as const,
        };
        return { transitioned: true, sourcePresetKey, targetPresetKey: targetMapPresetKey, targetEntranceId };
      } finally {
        transitioning = false;
      }
    },
  };
};
