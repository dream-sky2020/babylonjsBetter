import assert from 'node:assert/strict';
import test from 'node:test';
import { createEntityContainer, normalizeEntityContainer } from '../entity/entity.utils.ts';
import type { IEntity } from '../entity/entity.types.ts';
import { createDungeonMapData } from '../map/dungeonMap.create.ts';
import type { DungeonMapPreset } from '../map/dungeonMap.types.ts';
import { migrateDungeonMapToDocumentV2 } from './dungeonMapDocument.migrate.ts';
import { DungeonMapDocumentQuery } from './dungeonMapDocument.query.ts';
import { validateDungeonMapDocumentV2 } from './dungeonMapDocument.validation.ts';
import { compileDungeonMapDocumentTopology } from './dungeonMapDocument.compile.ts';
import { projectDungeonMapDocumentToLegacyMap } from './dungeonMapDocument.projection.ts';
import { validateDungeonMapData } from '../map/dungeonMap.ts';
import { encodeDungeonMapDocumentLibraryV2, parseDungeonMapDocumentV2 } from './dungeonMapDocument.codec.ts';

const entity = (id: string, componentType = 'state'): IEntity => ({
  id,
  entityType: 'test',
  name: id,
  components: [{ id: `${id}:component`, type: componentType, version: 1 }],
});

const createPreset = (): DungeonMapPreset => ({
  presetKey: 'v2-test',
  name: 'V2 测试地图',
  map: createDungeonMapData({
    id: 'map:v2-test',
    width: 2,
    height: 1,
    createMapData: () => createEntityContainer(entity('map-entity')),
    createTileData: ({ x }) => createEntityContainer(entity(`tile-entity-${x}`)),
    createTileEdgeData: ({ x, direction }) => (
      x === 0 && direction === 'east' ? createEntityContainer(entity('side-entity')) : undefined
    ),
    createSharedEdgeData: ({ second }) => (
      second ? createEntityContainer(entity('edge-entity')) : undefined
    ),
    createSharedPointData: ({ gridX, gridY }) => (
      gridX === 1 && gridY === 0 ? createEntityContainer(entity('point-entity')) : undefined
    ),
  }),
});

test('V1 嵌套地图迁移为方向拓扑和 ECS 分表', () => {
  const { document, warnings } = migrateDungeonMapToDocumentV2(createPreset());
  assert.deepEqual(warnings, []);
  assert.equal(document.schemaVersion, 2);
  assert.equal(document.grid.tileIds.length, 2);
  assert.equal(document.grid.tileSides.length, 2);
  assert.equal(document.grid.tileSides[0].length, 4);
  assert.equal(document.grid.tilePoints[0].length, 4);
  assert.equal(document.entities.length, 6);
  assert.equal(document.components.state.length, 6);
  assert.equal(document.components['spatial-attachment'].length, 6);
  assert.deepEqual(validateDungeonMapDocumentV2(document), []);
});

test('Query 可以通过 Tile、Side 和 Edge 查询 Entity 与相邻格', () => {
  const { document } = migrateDungeonMapToDocumentV2(createPreset());
  const query = new DungeonMapDocumentQuery(document);
  const firstTileId = query.getTileIdAt(0, 0);
  const secondTileId = query.getTileIdAt(1, 0);
  assert.ok(firstTileId);
  assert.ok(secondTileId);
  assert.equal(query.getNeighborTileId(firstTileId, 'east'), secondTileId);
  assert.equal(query.getNeighborTileId(firstTileId, 'west'), undefined);
  assert.deepEqual(query.getEntitiesAt({ kind: 'tile', tileId: firstTileId }).map(({ id }) => id), ['tile-entity-0']);
  const eastSide = query.getSide(firstTileId, 'east');
  assert.ok(eastSide);
  assert.deepEqual(query.getEntitiesAt({ kind: 'side', sideId: eastSide.id }).map(({ id }) => id), ['side-entity']);
  const sideContainer = query.getContainerAt({ kind: 'side', sideId: eastSide.id });
  assert.equal(sideContainer.entities[0].components[0].id, 'side-entity:component');
  assert.equal('entityId' in sideContainer.entities[0].components[0], false);
  const edge = query.getEdge(firstTileId, 'east');
  assert.ok(edge);
  assert.deepEqual(query.getEntitiesAt({ kind: 'edge', edgeId: edge.id }).map(({ id }) => id), ['edge-entity']);
});

test('同一旧 Entity 出现在多个容器时合并为空间多挂载', () => {
  const preset = createPreset();
  const shared = entity('shared-entity');
  preset.map.tiles[0].data = createEntityContainer(shared);
  preset.map.tiles[1].data = createEntityContainer(structuredClone(shared));
  const { document, warnings } = migrateDungeonMapToDocumentV2(preset);
  assert.deepEqual(warnings, []);
  assert.equal(document.entities.filter(({ id }) => id === shared.id).length, 1);
  assert.equal(document.components.state.filter(({ entityId }) => entityId === shared.id).length, 1);
  const attachment = document.components['spatial-attachment'].find(({ entityId }) => entityId === shared.id);
  assert.ok(attachment && Array.isArray(attachment.targets));
  assert.equal(attachment.targets.length, 2);
});

test('校验器拒绝不存在的空间目标', () => {
  const { document } = migrateDungeonMapToDocumentV2(createPreset());
  const attachment = document.components['spatial-attachment'][0];
  attachment.targets = [{ kind: 'tile', tileId: 'missing-tile' }];
  assert.ok(validateDungeonMapDocumentV2(document).some(({ code }) => code === 'attachment.missing-target'));
});

test('编译器生成每格 NESW 顺序的整数邻接数组', () => {
  const { document } = migrateDungeonMapToDocumentV2(createPreset());
  const compiled = compileDungeonMapDocumentTopology(document);
  assert.deepEqual([...compiled.neighborTileIndices], [
    -1, 1, -1, -1,
    -1, -1, -1, 0,
  ]);
  assert.ok([...compiled.sideIndices].every((index) => index >= 0));
  assert.ok([...compiled.edgeIndices].every((index) => index >= 0));
  assert.ok([...compiled.pointIndices].every((index) => index >= 0));
});

test('V2 可以投影成旧画布和消费者可读的嵌套快照', () => {
  const preset = createPreset();
  const { document } = migrateDungeonMapToDocumentV2(preset);
  const projected = projectDungeonMapDocumentToLegacyMap(document);
  assert.deepEqual(validateDungeonMapData(projected), []);
  assert.equal(projected.tiles[0].data?.entities[0].id, 'tile-entity-0');
  assert.equal(projected.tiles[0].edges.east.data?.entities[0].id, 'side-entity');
  const internalEdge = projected.sharedEdges?.find(({ sides }) => sides.length === 2);
  assert.equal(internalEdge?.edge.data?.entities[0].id, 'edge-entity');
});

test('V2 编解码会校验并规范化 Library key', () => {
  const { document } = migrateDungeonMapToDocumentV2(createPreset());
  assert.equal(parseDungeonMapDocumentV2(document, 'v2-test').identity.name, 'V2 测试地图');
  const encoded = encodeDungeonMapDocumentLibraryV2({ renamed: document });
  assert.equal(encoded.renamed.identity.presetKey, 'renamed');
  assert.throws(() => parseDungeonMapDocumentV2(document, 'wrong-key'), /presetKey/);
});

test('保存时清理旧编辑器生成的纯拓扑 Entity，并保留地形语义', () => {
  const shell = (id: string, name: string, entityType: string, legacy: Record<string, unknown>) => (
    normalizeEntityContainer({ legacy }, id, name, entityType)
  );
  const preset: DungeonMapPreset = {
    presetKey: 'shells',
    name: '占位壳测试',
    map: createDungeonMapData({
      id: 'map:shells',
      width: 1,
      height: 1,
      createTileData: () => shell('tile:0,0:entity', '格子 0,0', 'tile', { kind: 'wall' }),
      createTileEdgeData: ({ direction }) => shell(
        `tile:0,0:${direction}:entity`, `单格边 0,0,${direction}`, 'tile-edge', { kind: 'wall' },
      ),
      createSharedEdgeData: ({ id }) => shell(id + ':entity', '公用边实体', 'shared-edge', { kind: 'open' }),
      createSharedPointData: ({ id, gridX, gridY }) => shell(
        id + ':entity', '公用点实体', 'shared-point', { label: `公用点 ${gridX},${gridY}` },
      ),
    }),
  };
  const document = migrateDungeonMapToDocumentV2(preset).document;
  assert.ok(document.entities.length > 0);
  const encoded = encodeDungeonMapDocumentLibraryV2({ shells: document }).shells;
  assert.equal(encoded.entities.length, 0);
  assert.deepEqual(encoded.components, {});
  assert.equal(encoded.legacy?.tileProperties?.['tile:0,0']?.kind, 'wall');
  assert.ok(Object.values(encoded.legacy?.sideProperties ?? {}).every(({ kind }) => kind === 'wall'));
  assert.ok(Object.values(encoded.legacy?.edgeProperties ?? {}).every(({ kind }) => kind === 'open'));
  assert.deepEqual(validateDungeonMapDocumentV2(encoded), []);
});
