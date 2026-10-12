import assert from 'node:assert/strict';
import test from 'node:test';
import { LabMemoryRegistry } from '../../../lab-kit/shared-memory/LabMemory.ts';
import { DEFAULT_DEFORMATION_SETTINGS } from '../../../../core/render-deformation/deformation.ts';
import { createDungeonMapData } from '../../../../core/map/dungeonMap.create.ts';
import { createEntityContainer } from '../../../../core/entity/entity.utils.ts';
import { migrateDungeonMapToDocumentV2 } from '../../../../core/map-document/dungeonMapDocument.migrate.ts';
import { createDungeonDeformationData, DUNGEON_DEFORMATION_SETTINGS_MEMORY, readDungeonDeformationData } from './dungeonDeformation.memory.ts';

const settings = { ...structuredClone(DEFAULT_DEFORMATION_SETTINGS), enabled: true, restoreOutsideOverhead: true,
  config: { ...DEFAULT_DEFORMATION_SETTINGS.config, strength: 0.4 }, rules: [{ selector: 'group' as const, value: 'trees', strength: 0.5 }] };
const entity = { id: 'view', entityType: 'dungeon-overhead-view', enabled: true,
  components: [{ ...settings, id: 'deform', type: 'visual-deformation', version: 1 }] };
const document = (entities: typeof entity[] = []) => migrateDungeonMapToDocumentV2({ presetKey: 'test', name: 'Test',
  map: createDungeonMapData({ id: 'test', width: 2, height: 2, createMapData: () => createEntityContainer(...entities) }) }).document;

test('map settings become flat domain memory without document/runtime or a second rule copy', () => {
  const registry = new LabMemoryRegistry(), writer = registry.scope('loader').acquire(DUNGEON_DEFORMATION_SETTINGS_MEMORY);
  const reader = registry.scope('dungeon-visual-deformation').acquire(DUNGEON_DEFORMATION_SETTINGS_MEMORY);
  assert.equal(reader, writer); const data = createDungeonDeformationData(1, 'a', document([entity])); writer.replace(data);
  assert.deepEqual(readDungeonDeformationData(reader.require()), settings); assert.equal(data.hasMapSettings, true);
  for (const key of ['document', 'runtime', 'scene', 'config', 'settings']) assert.equal(key in data, false);
  const debug = registry.inspectValue(writer.key) as typeof data; assert.equal(debug.rules, data.rules);
  data.strength = 0.7; assert.equal(readDungeonDeformationData(reader.require()).config.strength, 0.7);
});

test('absent configs retain the old enabled default; invalid map config is diagnostic data rather than a load failure', () => {
  const absent = createDungeonDeformationData(1, 'a', document());
  assert.equal(absent.hasMapSettings, false); assert.equal(absent.enabled, true); assert.equal(absent.error, null);
  const disabled = createDungeonDeformationData(2, 'b', document([{ ...entity, components: [{ ...entity.components[0], enabled: false }] }]));
  assert.equal(disabled.enabled, false);
  const duplicate = { ...entity, id: 'view-2', components: [{ ...entity.components[0], id: 'deform-2' }] };
  const invalid = createDungeonDeformationData(3, 'c', document([entity, duplicate]));
  assert.match(invalid.error!, /多个显示变形配置/);
  new LabMemoryRegistry().scope('loader').acquire(DUNGEON_DEFORMATION_SETTINGS_MEMORY).replace(invalid);
});

test('replacement rejects malformed settings, preserves previous config, switches the stable handle and clears it', () => {
  const handle = new LabMemoryRegistry().scope('loader').acquire(DUNGEON_DEFORMATION_SETTINGS_MEMORY);
  const first = createDungeonDeformationData(1, 'a', document([entity])); handle.replace(first);
  assert.throws(() => handle.replace({ ...first, loadId: 2, heightScale: -1 }), /替换失败/); assert.equal(handle.current, first);
  handle.replace(createDungeonDeformationData(3, 'b', document())); assert.equal(handle.require().loadId, 3);
  handle.replace(null); assert.equal(handle.current, null);
});
