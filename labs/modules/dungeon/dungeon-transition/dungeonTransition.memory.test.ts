import assert from 'node:assert/strict';
import test from 'node:test';
import { LabMemoryRegistry } from '../../../kit/shared-memory/LabMemory.ts';
import type { IEntity } from '../../../../core/entity/entity.types.ts';
import { createEntityContainer } from '../../../../core/entity/entity.utils.ts';
import { createDungeonMapData } from '../../../../core/map/dungeonMap.create.ts';
import { migrateDungeonMapToDocumentV2 } from '../../../../core/map-document/dungeonMapDocument.migrate.ts';
import { createDungeonRuntimeMap } from '../../../../core/dungeon-runtime/dungeonRuntimeMap.ts';
import { createDungeonTransitionControl } from '../../../../core/dungeon-transition/dungeonTransitionControl.ts';
import { createDungeonTransitionController } from '../../../../core/dungeon-transition/dungeonTransition.ts';
import { createDungeonExitData } from '../../../../core/dungeon-transition/dungeonTransitionData.ts';
import type { DungeonExitBinding } from '../../../../core/dungeon-transition/dungeonTransition.types';
import { createDungeonTransitionData, DUNGEON_TRANSITION_DATA_MEMORY } from './dungeonTransition.memory.ts';

const exit = (id: string, triggers: string[]): IEntity => ({ id, entityType: 'dungeon-exit', components: [{
  id: `${id}-component`, type: 'dungeon-exit', version: 2, triggers, targetMapPresetKey: 'next', targetEntranceId: 'main',
}] });
const entrance: IEntity = { id: 'entrance', entityType: 'dungeon-entrance', components: [{
  id: 'entrance-component', type: 'dungeon-entrance', version: 1, entranceId: 'main', facing: 'north',
}] };
const document = () => migrateDungeonMapToDocumentV2({ presetKey: 'test', name: 'Test', map: createDungeonMapData({
  id: 'test', width: 3, height: 1,
  createTileData: ({ x }) => createEntityContainer(...(x === 1 ? [exit('enter', ['enter'])] : x === 2 ? [entrance] : [])),
  createTileEdgeData: ({ x, direction }) => createEntityContainer(...(x === 0 && direction === 'west'
    ? [exit('interact', ['interact'])] : x === 0 && direction === 'north' ? [exit('push', ['move-attempt'])] : [])),
}) }).document;

test('transition memory publishes only small descriptions and paginates the same arrays', () => {
  const registry = new LabMemoryRegistry(), reader = registry.scope('dungeon-transition').acquire(DUNGEON_TRANSITION_DATA_MEMORY);
  const writer = registry.scope('loader').acquire(DUNGEON_TRANSITION_DATA_MEMORY), data = createDungeonTransitionData(1, 'a', document());
  assert.equal(reader, writer); writer.replace(data); assert.equal(data.entrances.length, 1); assert.equal(data.exits.length, 3);
  assert.equal(data.entrances[0].entranceId, 'main');
  for (const item of data.exits) { assert.equal('entity' in item, false); assert.equal('component' in item, false); assert.equal('edge' in item.location, false); }
  const debug = registry.inspectValue(writer.key) as typeof data; assert.equal(debug.exits, data.exits); assert.equal(debug.entrances, data.entrances);
  assert.throws(() => writer.replace({ ...data, loadId: 2, exits: [{ ...data.exits[0], triggers: [] }] }), /替换失败/);
  assert.equal(reader.current, data); writer.replace(createDungeonTransitionData(3, 'b', document())); assert.equal(reader.require().loadId, 3);
  writer.replace(null); assert.equal(reader.current, null);
});

test('all three exit queries keep Core semantics and old Session queries are ignored', () => {
  const map = createDungeonRuntimeMap(document()); let active: { loadId: number; map: typeof map } | null = { loadId: 1, map };
  const control = createDungeonTransitionControl(() => active);
  assert.equal(control.findAfterMovement(1, { tileX: 0, tileY: 0 }, { tileX: 1, tileY: 0 })?.entityId, 'enter');
  assert.equal(control.findInteraction(1, { tileX: 0, tileY: 0 }, 'west')?.entityId, 'interact');
  assert.equal(control.findMoveAttempt(1, { tileX: 0, tileY: 0 }, 'north')?.entityId, 'push');
  assert.equal(control.findMoveAttempt(1, { tileX: 0, tileY: 0 }, 'east'), null);
  active = { loadId: 2, map }; assert.equal(control.findInteraction(1, { tileX: 0, tileY: 0 }, 'west'), null);
  active = null; assert.equal(control.findAfterMovement(2, { tileX: 0, tileY: 0 }, { tileX: 1, tileY: 0 }), null);
});

test('shared edge descriptions omit legacy graph snapshots', () => {
  const entity = exit('shared', ['interact']);
  const sides = [{ x: 0, y: 0, direction: 'east' as const }];
  const binding: DungeonExitBinding = { entity, component: entity.components[0] as DungeonExitBinding['component'],
    location: { kind: 'shared-edge', edgeId: 'edge', sides,
      edge: { id: 'legacy-graph', coordinates: { type: 'shared-edge', sides }, data: createEntityContainer() } },
  };
  const data = createDungeonExitData(binding); assert.equal('edge' in data.location, false);
  assert.equal(data.targetMapPresetKey, 'next'); assert.deepEqual(data.triggers, ['interact']);
});

test('descriptor target commands retain busy/rejection/finally behavior and legacy controller API', async () => {
  let finish!: (value: boolean) => void;
  const pending = new Promise<boolean>(resolve => { finish = resolve; });
  const controller = createDungeonTransitionController({ getCurrentPresetKey: () => 'source', switchDungeon: async () => pending });
  const target = { targetMapPresetKey: 'next', targetEntranceId: 'main' }, first = controller.transitionTo(target);
  assert.equal(controller.transitioning, true); assert.equal((await controller.transitionTo(target)).reason, 'busy');
  finish(false); assert.equal((await first).reason, 'switch-rejected'); assert.equal(controller.transitioning, false);
  const successful = createDungeonTransitionController({ getCurrentPresetKey: () => 'source', switchDungeon: async () => true });
  const binding = { component: target } as DungeonExitBinding;
  assert.deepEqual(await successful.transition(binding), await successful.transitionTo(target));
});
