import assert from 'node:assert/strict';
import test from 'node:test';
import { LabMemoryRegistry } from '../../../kit/shared-memory/LabMemory.ts';
import { DEFAULT_OVERHEAD_VIEW, resolveOverheadView } from '../../../../core/dungeon-view/dungeonOverheadView.ts';
import { createDungeonMapData } from '../../../../core/map/dungeonMap.create.ts';
import { createEntityContainer } from '../../../../core/entity/entity.utils.ts';
import { migrateDungeonMapToDocumentV2 } from '../../../../core/map-document/dungeonMapDocument.migrate.ts';
import { DUNGEON_OVERHEAD_SETTINGS_MEMORY, createDungeonOverheadSettingsData, readDungeonOverheadSettingsData } from './dungeonOverhead.memory.ts';

const config = { ...DEFAULT_OVERHEAD_VIEW, pitchDeg: 30, orthographicSize: 12, restoreDisplayInFirstPerson: true };
const entity = { id: 'view', entityType: 'dungeon-overhead-view', enabled: true,
  components: [{ ...config, id: 'overhead', type: 'dungeon-overhead-view', version: 1 }] };
const document = (entities: typeof entity[] = []) => migrateDungeonMapToDocumentV2({ presetKey: 'test', name: 'Test',
  map: createDungeonMapData({ id: 'test', width: 2, height: 2, createMapData: () => createEntityContainer(...entities) }) }).document;

test('overhead settings are flat, share a stable handle and retain the original Core display transform', () => {
  const registry = new LabMemoryRegistry(), writer = registry.scope('loader').acquire(DUNGEON_OVERHEAD_SETTINGS_MEMORY);
  const reader = registry.scope('dungeon-overhead-view').acquire(DUNGEON_OVERHEAD_SETTINGS_MEMORY);
  assert.equal(reader, writer); const data = createDungeonOverheadSettingsData(1, 'a', document([entity])); writer.replace(data);
  assert.deepEqual(readDungeonOverheadSettingsData(reader.require()), config);
  assert.deepEqual(resolveOverheadView(readDungeonOverheadSettingsData(data), [10, 0, 20], [2, 1, 2]),
    resolveOverheadView(config, [10, 0, 20], [2, 1, 2]));
  for (const key of ['document', 'runtime', 'sceneBinding', 'config']) assert.equal(key in data, false);
  const debug = registry.inspectValue(writer.key) as typeof data; debug.pitchDeg = 40; assert.equal(data.pitchDeg, 30);
  data.pitchDeg = 45; assert.equal(readDungeonOverheadSettingsData(reader.require()).pitchDeg, 45);
});

test('absent/disabled components remain absent; invalid config is diagnostic and can be published safely', () => {
  assert.equal(createDungeonOverheadSettingsData(1, 'a', document()).hasMapSettings, false);
  assert.equal(createDungeonOverheadSettingsData(2, 'b', document([{ ...entity, enabled: false }])).hasMapSettings, false);
  const duplicate = { ...entity, id: 'view-2', components: [{ ...entity.components[0], id: 'overhead-2' }] };
  const invalid = createDungeonOverheadSettingsData(3, 'c', document([entity, duplicate]));
  assert.match(invalid.error!, /多个启用的俯视显示配置/); assert.equal(invalid.hasMapSettings, false);
  new LabMemoryRegistry().scope('loader').acquire(DUNGEON_OVERHEAD_SETTINGS_MEMORY).replace(invalid);
});

test('malformed replacement retains old settings, map switches replace the handle and disposal clears it', () => {
  const handle = new LabMemoryRegistry().scope('loader').acquire(DUNGEON_OVERHEAD_SETTINGS_MEMORY);
  const first = createDungeonOverheadSettingsData(1, 'a', document([entity])); handle.replace(first);
  assert.throws(() => handle.replace({ ...first, pitchDeg: 0 }), /替换失败/); assert.equal(handle.current, first);
  handle.replace(createDungeonOverheadSettingsData(2, 'b', document())); assert.equal(handle.require().loadId, 2);
  handle.replace(null); assert.equal(handle.current, null);
});
