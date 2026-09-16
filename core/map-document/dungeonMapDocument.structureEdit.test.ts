import assert from 'node:assert/strict';
import test from 'node:test';
import { createEntityContainer } from '../entity/entity.utils.ts';
import type { IEntity } from '../entity/entity.types.ts';
import { createDungeonMapData } from '../map/dungeonMap.create.ts';
import { validateDungeonMapData } from '../map/dungeonMap.ts';
import type { DungeonMapPreset, DungeonMapTopologyMode } from '../map/dungeonMap.types.ts';
import { compileDungeonMapDocumentTopology } from './dungeonMapDocument.compile.ts';
import { migrateDungeonMapToDocumentV2 } from './dungeonMapDocument.migrate.ts';
import { DungeonMapDocumentQuery } from './dungeonMapDocument.query.ts';
import { projectDungeonMapDocumentToLegacyMap } from './dungeonMapDocument.projection.ts';
import {
  deleteDungeonMapDocumentColumn,
  deleteDungeonMapDocumentRow,
  insertDungeonMapDocumentColumn,
  insertDungeonMapDocumentRow,
} from './dungeonMapDocument.structureEdit.ts';
import { validateDungeonMapDocumentV2 } from './dungeonMapDocument.validation.ts';

const entity = (id: string, entityType = 'test'): IEntity => ({
  id,
  entityType,
  components: [{ id: `${id}:state`, type: 'state', version: 1 }],
});

const createPreset = (mode: DungeonMapTopologyMode = 'bounded', includeSpawn = true): DungeonMapPreset => ({
  presetKey: `structure-${mode}`,
  name: 'V2 结构编辑测试',
  map: createDungeonMapData({
    id: `map:structure-${mode}`,
    width: 2,
    height: 2,
    mode,
    createMapData: () => includeSpawn ? createEntityContainer({
      id: 'spawn',
      entityType: 'spawn-point',
      components: [{
        id: 'spawn:actor-spawn',
        type: 'actor-spawn',
        version: 1,
        tileX: 1,
        tileY: 1,
      }],
    }) : undefined,
    createTileData: ({ x, y }) => createEntityContainer(entity(`tile:${x},${y}:entity`)),
    createTileEdgeData: ({ x, y, direction }) => createEntityContainer(entity(`side:${x},${y}:${direction}:entity`)),
    createSharedEdgeData: ({ id }) => createEntityContainer(entity(`${id}:entity`)),
    createSharedPointData: ({ id }) => createEntityContainer(entity(`${id}:entity`)),
  }),
});

test('原生插入行保留既有拓扑 ID，并移动 Spawn 坐标', () => {
  const source = migrateDungeonMapToDocumentV2(createPreset()).document;
  const before = new DungeonMapDocumentQuery(source);
  const tileId = before.getTileIdAt(1, 1)!;
  const sideId = before.getSide(tileId, 'east')!.id;
  const result = insertDungeonMapDocumentRow(source, 1);
  const after = new DungeonMapDocumentQuery(result.document);
  assert.equal(result.document.grid.height, 3);
  assert.equal(after.getTileIdAt(1, 2), tileId);
  assert.equal(after.getSide(tileId, 'east')?.id, sideId);
  assert.equal(result.document.components['actor-spawn'][0].tileY, 2);
  assert.deepEqual(validateDungeonMapDocumentV2(result.document), []);
});

test('删除列会清理失效空间挂载、孤儿 ECS 数据与 Marker', () => {
  const source = migrateDungeonMapToDocumentV2(createPreset('bounded', false)).document;
  source.legacy = {
    ...source.legacy,
    markers: [{ id: 'removed', x: 0, y: 0 }, { id: 'kept', x: 1, y: 1 }],
  };
  const keptTileId = new DungeonMapDocumentQuery(source).getTileIdAt(1, 1)!;
  const result = deleteDungeonMapDocumentColumn(source, 0);
  assert.equal(result.document.grid.width, 1);
  assert.equal(new DungeonMapDocumentQuery(result.document).getTileIdAt(0, 1), keptTileId);
  assert.ok(!result.document.entities.some(({ id }) => id === 'tile:0,0:entity'));
  assert.ok(Object.values(result.document.components).flat().every(
    ({ entityId }) => result.document.entities.some(({ id }) => id === entityId),
  ));
  assert.deepEqual(result.document.legacy?.markers, [{ id: 'kept', x: 0, y: 1 }]);
  assert.deepEqual(result.impact.removedMarkerIds, ['removed']);
  assert.deepEqual(validateDungeonMapDocumentV2(result.document), []);
});

test('删除包含 Spawn 的行会在修改文档前被拒绝', () => {
  const source = migrateDungeonMapToDocumentV2(createPreset()).document;
  assert.throws(() => deleteDungeonMapDocumentRow(source, 1), /玩家出生点/);
  assert.equal(source.grid.height, 2);
});

test('新格默认 Entity ID 冲突时自动改名，四种拓扑均保持有效', () => {
  const modes: DungeonMapTopologyMode[] = ['bounded', 'loop-horizontal', 'loop-vertical', 'loop'];
  modes.forEach((mode) => {
    const source = migrateDungeonMapToDocumentV2(createPreset(mode, false)).document;
    const inserted = insertDungeonMapDocumentRow(source, 0, {
      createTileData: ({ x, y }) => createEntityContainer(entity(`tile:${x},${y}:entity`)),
    }).document;
    const edited = insertDungeonMapDocumentColumn(inserted, 1).document;
    assert.equal(new Set(edited.entities.map(({ id }) => id)).size, edited.entities.length);
    assert.deepEqual(validateDungeonMapDocumentV2(edited), []);
    assert.deepEqual(validateDungeonMapData(projectDungeonMapDocumentToLegacyMap(edited)), []);
    const compiled = compileDungeonMapDocumentTopology(edited);
    assert.equal(compiled.tileIds.length, edited.grid.width * edited.grid.height);
  });
});
