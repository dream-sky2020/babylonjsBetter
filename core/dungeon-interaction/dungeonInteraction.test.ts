import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { parseDungeonMapDocumentV3, encodeDungeonMapDocumentV3 } from '../map-document/dungeonMapDocument.storageV3.ts';
import { validateDungeonMapDocumentV2 } from '../map-document/dungeonMapDocument.validation.ts';
import { DungeonMapDocumentQuery } from '../map-document/dungeonMapDocument.query.ts';
import { createDungeonRuntime } from '../dungeon-runtime/dungeonRuntime.ts';
import { createDungeonInteractionControl } from './dungeonInteractionControl.ts';
import { DungeonInteractionRouter, type InteractionQuery } from './DungeonInteractionRouter.ts';
import { componentDefinition, upgradeInteractionEvent, validateInteractionEvent, type IEventComponent } from '../entity/components/event.component.ts';
import { DungeonMapDocumentStore } from '../map-document/dungeonMapDocument.store.ts';
import { validateDungeonInteractionDocument } from './dungeonInteraction.validation.ts';

const stored = () => JSON.parse(fs.readFileSync(new URL('../../config/dungeonMapPresets/dungeon_interaction_test.json', import.meta.url), 'utf8'));
const input = (trigger: InteractionQuery['trigger'] = 'interact'): InteractionQuery => ({ loadId: 1, trigger, position: { tileX: 1, tileY: 2 }, facing: 'south' });
const tick = () => new Promise(resolve => setImmediate(resolve));
const layout = { mapAnchorMode: 'first-tile' as const, mapOffset: [0, 0, 0] as const, tileSize: [7.5, .5, 7.5] as const, tileSpacing: [8, 8] as const };
function runtime(source = stored()) {
  const doc = parseDungeonMapDocumentV3(source);
  const value = createDungeonRuntime(doc, { sceneEnvironmentComponent: layout, tilePosition: { x: 1, y: 2 }, worldPosition: [8, .25, 16] });
  value.traversal.registerActor({ id: 'guide', kind: 'agent', tileIndex: 16, enabled: true, blocksMovement: true, movementProfileId: 'ground-four-way' });
  return value;
}
test('V3 interactions roundtrip, authoring permits incomplete drafts, execution rejects them, and V1 data is preserved', () => {
  const source = stored(), doc = parseDungeonMapDocumentV3(source);
  assert.deepEqual(validateDungeonInteractionDocument(doc), []);
  assert.deepEqual(encodeDungeonMapDocumentV3(doc).components.event, source.components.event);
  const draft = structuredClone(doc); Object.assign(draft.components.event[0], { action: { type: 'dialogue', presetKey: '', entryNodeId: '' } });
  assert.deepEqual(validateDungeonMapDocumentV2(draft), []);
  assert.ok(validateDungeonInteractionDocument(draft).length >= 2);
  const legacy: IEventComponent = { id: 'old', type: 'event', version: 1, trigger: 'custom-trigger', actionId: 'old-business', payload: { value: 7 }, once: true, extra: 'retain' };
  const upgraded = upgradeInteractionEvent(legacy);
  assert.equal(upgraded.extra, 'retain'); assert.equal(upgraded.once, true);
  assert.deepEqual(upgraded.action, { type: 'legacy', actionId: 'old-business', payload: { value: 7 } });
  assert.deepEqual(validateInteractionEvent(upgraded), []);
  assert.equal(legacy.version, 1);
  assert.ok(validateInteractionEvent({ ...upgraded, action: { type: 'dialogue', presetKey: 'test', entryNodeId: 'start' }, trigger: 'enter', targetRule: 'front' }).length);
});
test('NPC queries follow live position, reject moving/disabled actors and reject stale sessions', () => {
  const current = runtime(); let moving = false;
  const control = createDungeonInteractionControl(() => ({ loadId: 1, map: current.map, world: current.traversal, moving: () => moving }));
  assert.deepEqual(control.find(input()).map(item => item.entityId).sort(), ['guide', 'notice']);
  moving = true; assert.deepEqual(control.find(input()).map(item => item.entityId), ['notice']); moving = false;
  current.traversal.moveActor('guide', 18);
  assert.deepEqual(control.find(input()).map(item => item.entityId), ['notice']);
  const newPosition = { ...input(), position: { tileX: 3, tileY: 2 } };
  assert.deepEqual(control.find(newPosition).map(item => item.entityId), ['guide']);
  current.traversal.body('guide')!.enabled = false; assert.equal(control.find(newPosition).length, 0);
  assert.equal(control.find({ ...input(), loadId: 2 }).length, 0);
  assert.equal(control.find({ ...input('enter'), position: { tileX: 2, tileY: 2 } })[0].entityId, 'step-point');
});

test('authoring a new interaction point permits incremental fields and undo before execution', () => {
  const store = new DungeonMapDocumentStore(parseDungeonMapDocumentV3(stored()));
  store.addEntity({ id: 'draft-point', entityType: 'interaction-point' });
  store.attachEntity('draft-point', { kind: 'tile', tileId: 'tile:0,0' });
  const event = { ...componentDefinition.createDefault(), entityId: 'draft-point' };
  store.addComponent(event);
  assert.ok(validateDungeonInteractionDocument(store.getDocument()).length);
  store.updateComponent(event.id, { action: { type: 'dialogue', presetKey: 'dialogue_test' } });
  assert.ok(validateDungeonInteractionDocument(store.getDocument()).length);
  store.updateComponent(event.id, { action: { type: 'dialogue', presetKey: 'dialogue_test', entryNodeId: 'greeting' } });
  assert.deepEqual(validateDungeonInteractionDocument(store.getDocument()), []);
  assert.equal(store.undo(), true);
  assert.ok(validateDungeonInteractionDocument(store.getDocument()).length);
});

test('debug descriptions contain current positions, disabled state and exits without exposing live data', () => {
  const current = runtime();
  const control = createDungeonInteractionControl(() => ({ loadId: 1, map: current.map, world: current.traversal, moving: () => true }));
  assert.equal(control.describe(2).length, 0);
  const snapshot = control.describe(1);
  assert.equal(snapshot.length, 5);
  assert.equal(snapshot.find(row => row.entityId === 'once-notice')!.once, true);
  assert.equal(snapshot.find(row => row.entityId === 'exit')!.kind, 'transition');
  assert.equal(snapshot.find(row => row.entityId === 'guide')!.moving, true);
  const guide = current.traversal.body('guide')!;
  current.traversal.moveActor('guide', 18); guide.worldPosition = [24, .25, 24]; guide.enabled = false;
  const updated = control.describe(1).find(row => row.entityId === 'guide')!;
  assert.deepEqual(updated.placement, { kind: 'tile', tileX: 3, tileY: 3 });
  assert.equal(updated.enabled, false);
  updated.worldPosition![0] = 999;
  assert.equal(guide.worldPosition[0], 24);
  assert.equal(current.map.document.components.event[0].enabled, undefined);
});
test('a different wall occludes an NPC while the NPC own collision does not', () => {
  const source = stored(), doc = parseDungeonMapDocumentV3(source);
  const side = new DungeonMapDocumentQuery(doc).getSide('tile:1,2', 'south')!;
  source.entities.push({ id: 'wall', entityType: 'spatial-object', enabled: true });
  source.components['spatial-attachment'].push({ id: 'wall:attachment', entityId: 'wall', type: 'spatial-attachment', version: 1, targets: [{ kind: 'side', sideId: side.id }] });
  source.components['spatial-body'].push({ id: 'wall:body', entityId: 'wall', type: 'spatial-body', version: 1, activeByDefault: true, mobility: 'fixed', pushable: false, initialFacing: 'north', movementProfileId: 'ground' });
  source.components['spatial-collider'].push({ id: 'wall:collider', entityId: 'wall', type: 'spatial-collider', version: 1, response: 'block', footprint: 'full-tile', shape: 'boundary', radius: .2, halfWidth: .5, halfHeight: .5, offsetX: 0, offsetY: 0 });
  const current = runtime(source);
  const control = createDungeonInteractionControl(() => ({ loadId: 1, map: current.map, world: current.traversal, moving: () => false }));
  assert.deepEqual(control.find(input()).map(item => item.entityId), ['notice']);
});
test('one trigger selects one action, ties fail closed, and blocking/async reset cannot execute a second action', async () => {
  const router = new DungeonInteractionRouter(); let talk = 0, teleport = 0, release!: () => void;
  const off = router.register({ id: 'dialogue', find: () => [{ id: 'talk', entityId: 'npc', label: 'NPC', priority: 10, rank: 0,
    execute: () => { talk++; return new Promise<void>(resolve => { release = resolve; }); } }] });
  router.register({ id: 'transition', find: () => [{ id: 'exit', entityId: 'exit', label: '出口', priority: 0, rank: 0, execute: () => { teleport++; } }] });
  assert.equal(router.dispatch(input()), true); router.dispatch(input()); assert.equal(talk, 1); assert.equal(teleport, 0);
  const previous = release;
  router.reset(); router.dispatch(input()); const latest = release;
  previous(); await tick(); assert.equal(router.inspect().busy, true);
  latest(); await tick(); assert.equal(router.inspect().busy, false);
  off(); router.dispatch(input()); await tick(); assert.equal(teleport, 1);
  router.register({ id: 'conflict', find: () => [{ id: 'other', entityId: 'other', label: '调查点', priority: 0, rank: 0, execute: () => { talk++; } }] });
  router.dispatch(input()); assert.match(router.inspect().error, /冲突/); assert.equal(teleport, 1);
  assert.equal(router.dispatch({ ...input('enter'), from: { ...input().position } }), false);
  router.dispose(); assert.equal(router.dispatch(input()), false);
});
