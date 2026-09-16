import assert from 'node:assert/strict';
import test from 'node:test';
import { createEntityContainer } from '../entity/entity.utils.ts';
import { createDungeonMapData } from '../map/dungeonMap.create.ts';
import type { DungeonMapPreset } from '../map/dungeonMap.types.ts';
import { migrateDungeonMapToDocumentV2 } from '../map-document/dungeonMapDocument.migrate.ts';
import { projectDungeonMapDocumentToLegacyMap } from '../map-document/dungeonMapDocument.projection.ts';
import { createDungeonMapCanvasView } from './dungeon-map-canvas-view.ts';

const container = (id: string) => createEntityContainer({
  id,
  entityType: 'visual-test',
  components: [{ id: `${id}:visual`, type: 'visual', version: 1 }],
});

test('V2 Canvas 视图直接还原格子、Side、Edge 与 Point 绘制数据', () => {
  const preset: DungeonMapPreset = {
    presetKey: 'canvas-view',
    name: 'Canvas 视图',
    map: createDungeonMapData({
      id: 'map:canvas-view',
      width: 2,
      height: 2,
      mode: 'loop',
      createTileData: ({ x, y }) => container(`tile:${x},${y}`),
      createTileEdgeData: ({ x, y, direction }) => container(`side:${x},${y}:${direction}`),
      createSharedEdgeData: ({ id }) => container(`edge:${id}`),
      createSharedPointData: ({ id }) => container(`point:${id}`),
    }),
  };
  const document = migrateDungeonMapToDocumentV2(preset).document;
  const view = createDungeonMapCanvasView(document);
  const compatibility = projectDungeonMapDocumentToLegacyMap(document);

  assert.deepEqual(view, {
    width: compatibility.width,
    height: compatibility.height,
    tiles: compatibility.tiles,
    sharedEdges: compatibility.sharedEdges,
    sharedPoints: compatibility.sharedPoints,
  });
  assert.ok(view.sharedEdges.some(({ sides }) => sides.length === 2));
  assert.ok(view.sharedPoints.some(({ positions }) => positions.length === 4));
});

test('没有 ECS 数据的空间目标不会制造空容器', () => {
  const preset: DungeonMapPreset = {
    presetKey: 'canvas-empty',
    name: '空 Canvas',
    map: createDungeonMapData({ id: 'map:canvas-empty', width: 1, height: 1 }),
  };
  const view = createDungeonMapCanvasView(migrateDungeonMapToDocumentV2(preset).document);
  assert.equal(view.tiles[0].data, undefined);
  assert.ok(Object.values(view.tiles[0].edges).every(({ data }) => data === undefined));
  assert.ok(view.sharedEdges.every(({ edge }) => edge.data === undefined));
  assert.ok(view.sharedPoints.every(({ point }) => point.data === undefined));
});
