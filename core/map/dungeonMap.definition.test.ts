import assert from 'node:assert/strict';
import test from 'node:test';
import type { IEntityContainer } from '../entity/entity.types.ts';
import { decodeDungeonMapData, encodeDungeonMapData } from './dungeonMap.definition.ts';
import type { DungeonMapData, DungeonMapDirection } from './dungeonMap.types.ts';

const container = (id: string, entityType: string, name: string, kind: string): IEntityContainer => ({
  entities: [{
    id: `${id}:entity`,
    entityType,
    name,
    enabled: true,
    components: [{ id: `${id}:entity:legacy`, type: 'legacy-data', version: 1, data: { legacy: { kind } } }],
  }],
});

test('definition refs preserve every dungeon map semantic layer', () => {
  const directions: DungeonMapDirection[] = ['north', 'east', 'south', 'west'];
  const map = {
    id: 'test-map',
    coordinates: { type: 'map', x: 0, y: 0, width: 1, height: 1 },
    data: container('test-map', 'map', '地图实体', 'map'),
    topologyMode: 'bounded',
    width: 1,
    height: 1,
    tiles: [{
      x: 0,
      y: 0,
      coordinates: { type: 'tile', x: 0, y: 0 },
      data: container('tile:0,0', 'tile', '格子 0,0', 'floor'),
      edges: Object.fromEntries(directions.map((direction) => [direction, {
        id: `tile:0,0:${direction}`,
        coordinates: { type: 'tile-edge', x: 0, y: 0, direction },
        data: container(`tile:0,0:${direction}`, 'tile-edge', `单格边 0,0,${direction}`, 'open'),
      }])) as DungeonMapData['tiles'][number]['edges'],
    }],
    sharedEdges: [{
      id: 'shared-boundary:0,0:east',
      sides: [{ x: 0, y: 0, direction: 'east' }],
      edge: {
        id: 'shared-boundary:0,0:east',
        coordinates: { type: 'shared-edge', sides: [{ x: 0, y: 0, direction: 'east' }] },
        data: container('shared-boundary:0,0:east', 'shared-edge', '公用边实体', 'edge:east'),
      },
    }],
    sharedPoints: [{
      id: 'point:0,0',
      gridX: 0,
      gridY: 0,
      positions: [{ gridX: 0, gridY: 0 }],
      sides: [{ x: 0, y: 0, corner: 'north-west' }],
      point: {
        id: 'point:0,0',
        coordinates: { type: 'shared-point', gridX: 0, gridY: 0, positions: [{ gridX: 0, gridY: 0 }] },
        data: container('point:0,0', 'shared-point', '公用点实体', 'point'),
      },
    }],
  } satisfies DungeonMapData;

  const stored = encodeDungeonMapData(map);
  assert.equal(stored.format, 'definition-refs');
  assert.ok(stored.mapDataDefinitionRef >= 0);
  assert.equal(stored.tileDataDefinitionRefs.length, 1);
  assert.deepEqual(stored.tileEdgeDataDefinitionRefs.map((layer) => layer.length), [1, 1, 1, 1]);
  assert.equal(stored.sharedEdges.length, map.sharedEdges?.length);
  assert.equal(stored.sharedPoints.length, map.sharedPoints?.length);
  assert.ok(stored.dataDefinitions.length <= 5);

  const decoded = decodeDungeonMapData(stored);
  assert.deepEqual(decoded, map);
  assert.equal(decoded.data?.entities[0]?.id, 'test-map:entity');
});

test('legacy object maps remain readable during migration', () => {
  const map = {
    id: 'legacy-map',
    coordinates: { type: 'map', x: 0, y: 0, width: 1, height: 1 },
    width: 1,
    height: 1,
    tiles: [],
  } as unknown as DungeonMapData;
  const decoded = decodeDungeonMapData(map);
  assert.deepEqual(decoded, map);
  assert.notEqual(decoded, map);
});
