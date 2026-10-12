import assert from 'node:assert/strict';
import test from 'node:test';
import { LabMemoryRegistry } from '../../../lab-kit/shared-memory/LabMemory.ts';
import { resolveDungeonMapTileWorldLayout, type DungeonMapTileLayoutSettings } from '../../../../core/scene/dungeonMapSceneLayout.ts';
import { DUNGEON_GRID_MEMORY, createDungeonGridData } from './dungeonGrid.memory.ts';

const map = (width = 4, height = 2) => ({
  id: `map-${width}-${height}`, width, height,
  topology: { tileIds: Array.from({ length: width * height }, (_, index) => `tile-${index}`) },
});
const settings = (mapAnchorMode: DungeonMapTileLayoutSettings['mapAnchorMode'] = 'map-center'): DungeonMapTileLayoutSettings => ({
  mapAnchorMode, mapOffset: [100, 6, -50], tileSpacing: [10, 12], tileSize: [8, 2, 10],
});

test('grid consumers acquire one small handle and share Core topology/layout arrays', () => {
  const registry = new LabMemoryRegistry();
  const consumer = registry.scope('dungeon-grid').acquire(DUNGEON_GRID_MEMORY);
  const publisher = registry.scope('dungeon-map-loader').acquire(DUNGEON_GRID_MEMORY);
  assert.equal(consumer, publisher); assert.equal(consumer.current, null);
  const sourceMap = map(), sourceSettings = settings(), data = createDungeonGridData(1, 'a', sourceMap, sourceSettings);
  publisher.replace(data);
  assert.equal(consumer.current, data);
  assert.equal(data.tileIds, sourceMap.topology.tileIds); assert.equal(data.mapOffset, sourceSettings.mapOffset);
  assert.equal(data.tileSpacing, sourceSettings.tileSpacing); assert.equal(data.tileSize, sourceSettings.tileSize);
  assert.equal('runtime' in data, false); assert.equal('document' in data, false); assert.equal('sceneBinding' in data, false);
  assert.deepEqual(registry.inspect()[0].modules, ['dungeon-grid', 'dungeon-map-loader']);
});

test('narrow layout data preserves Core coordinates for both map anchors and live array updates', () => {
  const offset: [number, number, number] = [100, 6, -50];
  const centered = { ...settings(), mapOffset: offset }, grid = createDungeonGridData(1, 'a', map(), centered);
  assert.deepEqual(resolveDungeonMapTileWorldLayout(grid, grid.width, grid.height, 2, 1), { center: [105, 6, -44], size: [8, 2, 10] });
  const origin = createDungeonGridData(2, 'b', map(), settings('first-tile'));
  assert.deepEqual(resolveDungeonMapTileWorldLayout(origin, origin.width, origin.height, 2, 1), { center: [120, 7, -38], size: [8, 2, 10] });
  offset[0] = 200;
  assert.deepEqual(resolveDungeonMapTileWorldLayout(grid, grid.width, grid.height, 2, 1), resolveDungeonMapTileWorldLayout(centered, 4, 2, 2, 1));
});

test('invalid candidates retain the old grid; successful switches and release update the stable handle', () => {
  const registry = new LabMemoryRegistry(), handle = registry.scope('loader').acquire(DUNGEON_GRID_MEMORY);
  const reader = registry.scope('dungeon-grid').acquire(DUNGEON_GRID_MEMORY);
  const first = createDungeonGridData(1, 'a', map(), settings()); handle.replace(first);
  const bad = createDungeonGridData(2, 'b', map(), settings()); bad.tileIds = [];
  assert.throws(() => handle.replace(bad), /替换失败/); assert.equal(reader.current, first);
  const second = createDungeonGridData(3, 'c', map(2, 3), settings()); handle.replace(second);
  assert.equal(reader.current, second); assert.equal(reader.current.tileIds.length, 6);
  handle.replace(null); assert.equal(reader.current, null);
});

test('grid inspection previews at most twenty IDs and detaches its small debug arrays', () => {
  const registry = new LabMemoryRegistry(), handle = registry.scope('loader').acquire(DUNGEON_GRID_MEMORY);
  const sourceMap = map(100, 100), sourceSettings = settings();
  handle.replace(createDungeonGridData(1, 'large', sourceMap, sourceSettings));
  const preview = registry.inspectValue(handle.key) as { tileCount: number; tileIdPreview: string[]; tileIdsTruncated: boolean; mapOffset: number[] };
  assert.equal(preview.tileCount, 10000); assert.equal(preview.tileIdPreview.length, 20); assert.equal(preview.tileIdsTruncated, true);
  preview.tileIdPreview[0] = 'changed'; preview.mapOffset[0] = 999;
  assert.equal(sourceMap.topology.tileIds[0], 'tile-0'); assert.equal(sourceSettings.mapOffset[0], 100);
});
