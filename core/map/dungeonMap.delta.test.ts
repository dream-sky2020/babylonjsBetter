import assert from 'node:assert/strict';
import test from 'node:test';
import type { IEntityContainer } from '../entity/entity.types.ts';
import {
  applyDungeonMapDefinitionRefsDelta,
  applyDungeonMapDelta,
  createEmptyDungeonMapDefinitionRefsDelta,
} from './dungeonMap.delta.ts';
import { encodeDungeonMapData } from './dungeonMap.definition.ts';
import type { DungeonMapData, DungeonMapDirection } from './dungeonMap.types.ts';

const container = (instanceId: string, value: string): IEntityContainer => ({
  entities: [{
    id: `${instanceId}:entity`,
    entityType: 'tile',
    components: [{ id: `${instanceId}:entity:data`, type: 'legacy-data', version: 1, value }],
  }],
});

const createMap = (): DungeonMapData => {
  const directions: DungeonMapDirection[] = ['north', 'east', 'south', 'west'];
  return {
    id: 'delta-map',
    coordinates: { type: 'map', x: 0, y: 0, width: 2, height: 1 },
    width: 2,
    height: 1,
    topologyMode: 'bounded',
    tiles: [0, 1].map((x) => ({
      x,
      y: 0,
      coordinates: { type: 'tile', x, y: 0 },
      data: container(`tile:${x},0`, 'base'),
      edges: Object.fromEntries(directions.map((direction) => [direction, {
        id: `tile:${x},0:${direction}`,
        coordinates: { type: 'tile-edge', x, y: 0, direction },
        data: container(`tile:${x},0:${direction}`, 'edge'),
      }])) as DungeonMapData['tiles'][number]['edges'],
    })),
    sharedEdges: [],
    sharedPoints: [],
  };
};

test('sparse reference delta overlays definitions without mutating the base map', () => {
  const base = encodeDungeonMapData(createMap());
  const original = structuredClone(base);
  const deltaDefinition = structuredClone(base.dataDefinitions[base.tileDataDefinitionRefs[0]]);
  deltaDefinition.entities[0].components[0].value = 'delta';
  const delta = {
    ...createEmptyDungeonMapDefinitionRefsDelta('dungeon_map', base),
    dataDefinitions: [deltaDefinition],
    tileDataDefinitionRefChanges: [[1, base.dataDefinitions.length]],
    tileEdgeDataDefinitionRefChanges: [[[0, null]], [], [], []],
  } as const;

  const resolvedStored = applyDungeonMapDefinitionRefsDelta(base, delta, 'dungeon_map');
  assert.deepEqual(base, original);
  assert.equal(resolvedStored.dataDefinitions.length, base.dataDefinitions.length + 1);
  assert.equal(resolvedStored.tileDataDefinitionRefs[0], base.tileDataDefinitionRefs[0]);
  assert.equal(resolvedStored.tileDataDefinitionRefs[1], base.dataDefinitions.length);
  assert.equal(resolvedStored.tileEdgeDataDefinitionRefs[0][0], -1);

  const resolved = applyDungeonMapDelta(base, delta, 'dungeon_map');
  assert.equal(resolved.tiles[0].data?.entities[0].components[0].value, 'base');
  assert.equal(resolved.tiles[1].data?.entities[0].components[0].value, 'delta');
  assert.equal(resolved.tiles[0].edges.east.data, undefined);
});

test('sparse reference delta rejects a changed base map', () => {
  const base = encodeDungeonMapData(createMap());
  const delta = createEmptyDungeonMapDefinitionRefsDelta('dungeon_map', base);
  const changedBase = structuredClone(base);
  changedBase.metadata = { revision: 2 };
  assert.throws(
    () => applyDungeonMapDefinitionRefsDelta(changedBase, delta, 'dungeon_map'),
    /指纹不匹配/,
  );
});
