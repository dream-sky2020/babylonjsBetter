import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import { parseDungeonMapDocumentV3, encodeDungeonMapDocumentV3 } from '../map-document/dungeonMapDocument.storageV3.ts';
import { validateDungeonMapDocumentV2 } from '../map-document/dungeonMapDocument.validation.ts';
import { createDungeonRuntime } from '../dungeon-runtime/dungeonRuntime.ts';
import { createDungeonInteractionControl } from './dungeonInteractionControl.ts';
import { createDefaultDungeonAgentControllerRegistry, updateDungeonAgentControllers } from '../dungeon-agent/dungeonAgent.controllers.ts';
import { createDungeonAgentRuntimeState, requestDungeonAgentInteraction, startDungeonAgentMovement, startDungeonAgentTurn, updateDungeonAgentMovements } from '../dungeon-agent/dungeonAgent.runtime.ts';
import type { DungeonAgentInteractionIntent } from '../dungeon-agent/dungeonAgent.types.ts';
import { DUNGEON_PLAYER_TRAVERSAL_ACTOR_ID } from '../dungeon-traversal/dungeonTraversal.ts';
import { interactionArrivalSide, interactionOnceKey, relativeInteractionSide, worldInteractionSide } from './dungeonInteraction.direction.ts';
import { validateDungeonInteractionDocument } from './dungeonInteraction.validation.ts';
import { componentDefinition, validateInteractionEvent } from '../entity/components/event.component.ts';
import { DungeonMapDocumentQuery } from '../map-document/dungeonMapDocument.query.ts';
import type { InteractionQuery } from './DungeonInteractionRouter.ts';

const source = () => JSON.parse(fs.readFileSync(new URL('../../config/dungeonMapPresets/dungeon_direction_test.json', import.meta.url), 'utf8'));
function setup(data = source()) {
  const document = parseDungeonMapDocumentV3(data);
  const runtime = createDungeonRuntime(document, { sceneEnvironmentComponent: { mapAnchorMode: 'first-tile', mapOffset: [0, 0, 0], tileSize: [1, .5, 1], tileSpacing: [1, 1] }, tilePosition: { x: 2, y: 2 }, worldPosition: [2, .25, 2] });
  const agents = createDungeonAgentRuntimeState(runtime.map, runtime.traversal, runtime.movementResolver);
  const control = createDungeonInteractionControl(() => ({ loadId: 1, map: runtime.map, world: runtime.traversal,
    facing: id => agents.agents.find(agent => agent.binding.entity.id === id)?.facing,
    moving: id => !!agents.agents.find(agent => agent.binding.entity.id === id)?.movement || runtime.movementResolver.isBusy(id) }));
  return { runtime, agents, control, document };
}
const input = (x: number, y: number, facing: InteractionQuery['facing']): InteractionQuery => ({ loadId: 1, trigger: 'interact', position: { tileX: x, tileY: y }, facing });
const entry = (value: ReturnType<typeof setup>, query: InteractionQuery, entity = 'guide') => value.control.find(query).flatMap(row =>
  row.entityId === entity && row.action.type === 'dialogue' ? [row.action.entryNodeId] : []);

const room = () => JSON.parse(fs.readFileSync(new URL('../../config/dungeonMapPresets/dungeon_interaction_room.json', import.meta.url), 'utf8'));

test('completed Agent step uses its real approach and the rule actor scope', () => {
  const value = setup(room());
  const actorId = 'room-agent-patrol';
  const intents: DungeonAgentInteractionIntent[] = [];
  value.agents.onInteraction = intent => intents.push(intent);
  startDungeonAgentMovement(value.agents, value.runtime.map, actorId, 'south', { durationSeconds: 0 });
  intents.length = 0;
  startDungeonAgentMovement(value.agents, value.runtime.map, actorId, 'south', { durationSeconds: .3 });
  updateDungeonAgentMovements(value.agents, .2);
  assert.equal(intents.length, 0, 'committing the tile is earlier than finishing the step');
  updateDungeonAgentMovements(value.agents, .2);
  assert.deepEqual(intents, [{ actorId, trigger: 'enter', tileIndex: 24, fromTileIndex: 15, facing: 'south', movementDirection: 'south' }]);

  const query: InteractionQuery = {
    ...input(6, 2, 'south'), trigger: 'enter', from: { tileX: 6, tileY: 1 }, movementDirection: 'south', actorId,
  };
  assert.deepEqual(value.control.find(query).map(match => match.id), ['room-agent-plate:enter-north']);
  assert.equal(value.control.find({ ...query, actorId: undefined }).length, 0);
  assert.equal(value.control.find({ ...query, from: { tileX: 6, tileY: 3 }, movementDirection: 'north' }).length, 0);

  const both = room();
  both.components.event.find((event: { id: string }) => event.id === 'room-agent-plate:enter-north').actorScope = 'both';
  const shared = setup(both);
  assert.equal(shared.control.find(query).length, 1);
  assert.equal(shared.control.find({ ...query, actorId: undefined }).length, 1);
});

test('Agent attempts distinguish physical blocker IDs from reservation losses', () => {
  const value = setup(room());
  const intents: DungeonAgentInteractionIntent[] = [];
  value.agents.onInteraction = intent => intents.push(intent);
  const actorId = 'room-agent-obstacle-check';
  assert.equal(startDungeonAgentMovement(value.agents, value.runtime.map, actorId, 'north').started, false);
  assert.equal(intents.length, 1);
  const contact = intents[0];
  assert.equal(contact.trigger, 'move-attempt');
  const { attemptId, ...result } = contact;
  assert.ok(attemptId > 0);
  assert.deepEqual(result, {
    trigger: 'move-attempt', outcome: 'blocked', actorId, tileIndex: 43, facing: 'north', movementDirection: 'north', blockingEntityIds: ['room-contact-barrier'],
  });
  const query: InteractionQuery = {
    ...input(7, 4, 'north'), trigger: 'move-attempt', actorId, movementDirection: 'north', blockingEntityIds: ['room-contact-barrier'],
  };
  assert.deepEqual(value.control.find(query).map(match => match.id), ['room-contact-barrier:agent-contact']);
  assert.equal(value.control.find({ ...query, blockingEntityIds: ['room-console'] }).length, 0);
  assert.equal(value.control.find({ ...query, blockingEntityIds: [] }).length, 0);

  intents.length = 0;
  value.runtime.traversal.registerActor({ id: 'reservation-winner', kind: 'agent', tileIndex: 16, enabled: true, blocksMovement: true, movementProfileId: 'ground' });
  assert.equal(value.runtime.movementResolver.requestMove({ actorId: 'reservation-winner', direction: 'west', durationSeconds: 1, basePriority: 1000 }).accepted, true);
  assert.equal(startDungeonAgentMovement(value.agents, value.runtime.map, 'room-agent-patrol', 'south').started, false);
  assert.equal(intents.length, 1);
  const rejected = intents[0];
  assert.equal(rejected.trigger, 'move-attempt');
  assert.equal(rejected.outcome, 'arbitration-rejected');
  assert.deepEqual(rejected.blockingEntityIds, []);
});

test('Agent active command uses its own pose and only searches forward', () => {
  const value = setup(room());
  const actorId = 'room-agent-operator';
  const intents: DungeonAgentInteractionIntent[] = [];
  value.agents.onInteraction = intent => intents.push(intent);
  assert.equal(requestDungeonAgentInteraction(value.agents, actorId), true);
  assert.deepEqual(intents, [{ trigger: 'interact', actorId, tileIndex: 61, facing: 'north' }]);
  const query = { ...input(7, 6, 'north'), actorId };
  assert.deepEqual(value.control.find(query).map(match => match.id), ['room-message-pad:agent-interact']);
  assert.equal(value.control.find({ ...query, facing: 'south' }).length, 0);

  const self = room();
  self.components.event.find((event: { id: string }) => event.id === 'room-message-pad:agent-interact').targetRule = 'self';
  self.components['spatial-attachment'].find((attachment: { entityId: string }) => attachment.entityId === 'room-message-pad').targets[0].tileId = 'tile:7,6';
  assert.equal(setup(self).control.find(query).length, 0);
});

test('the chasing Agent attempts a physical step into the player and matches both participant rules', () => {
  const data = JSON.parse(fs.readFileSync(new URL('../../config/dungeonMapPresets/dungeon_interaction_test.json', import.meta.url), 'utf8'));
  const actorId = 'test-player-tracker';
  const trackerRule = data.components.event.find((event: { entityId: string }) => event.entityId === actorId);
  data.components.event.push({ ...trackerRule, id: 'external-observer', entityId: 'room-message-pad', mover: 'entity', moverId: actorId, blocker: 'any' });
  const { runtime, agents, control } = setup(data);
  const width = runtime.map.width;
  const registry = createDefaultDungeonAgentControllerRegistry();
  const playerRule = { id: 'player-contact', type: 'event' as const, version: 2, ruleKind: 'action' as const,
    trigger: 'move-attempt', mover: 'any' as const, blocker: 'self' as const, priority: 0,
    action: { type: 'message' as const, text: '挡住了其他实体' } };
  let attempts = 0;
  agents.onInteraction = intent => {
    if (intent.trigger !== 'move-attempt' || intent.actorId !== actorId || !intent.blockingEntityIds.includes(DUNGEON_PLAYER_TRAVERSAL_ACTOR_ID)) return;
    const query = { ...input(intent.tileIndex % width, Math.floor(intent.tileIndex / width), 'south'), trigger: intent.trigger, actorId,
      blockingEntityIds: intent.blockingEntityIds, movementPhase: 'blocked' as const };
    const matches = control.find(query, [playerRule]);
    assert.deepEqual(matches.map(match => match.id), [`${actorId}:blocked-by-player`, 'external-observer', 'player-contact']);
    assert.deepEqual(matches[0].contactBlockers, [DUNGEON_PLAYER_TRAVERSAL_ACTOR_ID]);
    assert.equal(control.find({ ...query, blockingEntityIds: [] }, [playerRule]).length, 0);
    assert.deepEqual(control.find({ ...query, blockingEntityIds: ['room-contact-barrier'] }, [playerRule]).map(match => match.id), ['external-observer']);
    assert.equal(control.find({ ...query, movementPhase: 'contact' }, [playerRule]).length, 0);
    attempts++;
  };
  const run = (playerTileIndex: number) => {
    runtime.traversal.moveActor(DUNGEON_PLAYER_TRAVERSAL_ACTOR_ID, playerTileIndex);
    for (let frame = 0; frame < 30; frame++) {
      updateDungeonAgentMovements(agents, .1);
      updateDungeonAgentControllers(agents, runtime.map, registry, .1, { playerTileIndex });
    }
  };
  run(2 * width + 1);
  assert.ok(attempts > 0);
  assert.equal(control.movementBlockers(1, actorId).has(DUNGEON_PLAYER_TRAVERSAL_ACTOR_ID), true);
  const before = attempts;
  runtime.traversal.moveActor(DUNGEON_PLAYER_TRAVERSAL_ACTOR_ID, 3);
  assert.equal(control.movementBlockers(1, actorId).has(DUNGEON_PLAYER_TRAVERSAL_ACTOR_ID), false);
  run(3);
  assert.ok(attempts > before);
});

test('legacy chase rules load as physical-block rules and update their old controller parameters', () => {
  const data = JSON.parse(fs.readFileSync(new URL('../../config/dungeonMapPresets/dungeon_interaction_test.json', import.meta.url), 'utf8'));
  const actorId = 'test-player-tracker';
  const event = data.components.event.find((row: { entityId: string }) => row.entityId === actorId);
  Object.assign(event, { trigger: 'approach-player', targetRule: 'self', actorScope: 'agent' });
  const oldController = data.components['agent-controller'].find((row: { entityId: string }) => row.entityId === actorId);
  oldController.parameters = { notifyOnApproach: true, stopDistance: 1, navigationStrategy: 'direct' };
  const migrated = parseDungeonMapDocumentV3(data);
  assert.deepEqual(validateDungeonInteractionDocument(migrated), []);
  assert.deepEqual(migrated.components['agent-controller'].find(row => row.entityId === actorId)?.parameters,
    { stopDistance: 0, navigationStrategy: 'path' });
  const migratedEvent = migrated.components.event.find(row => row.entityId === actorId)!;
  assert.equal(migratedEvent.trigger, 'move-attempt');
  assert.equal(migratedEvent.blockerId, DUNGEON_PLAYER_TRAVERSAL_ACTOR_ID);
  assert.equal(migratedEvent.targetRule, undefined);
});

test('all four NPC approach sides, live turn animation exclusion, and completed facing changes', () => {
  const value = setup();
  assert.deepEqual(entry(value, input(2, 2, 'south')), ['direction-front']);
  assert.deepEqual(entry(value, input(2, 4, 'north')), ['direction-back']);
  assert.deepEqual(entry(value, input(1, 3, 'east')), ['direction-side']);
  assert.deepEqual(entry(value, input(3, 3, 'west')), ['direction-side']);
  assert.deepEqual(entry(value, input(2, 2, 'north')), [], 'standing in front does not allow interacting while looking away');
  startDungeonAgentTurn(value.agents, 'guide', 'back', .1);
  assert.deepEqual(entry(value, input(2, 2, 'south')), []);
  assert.match(value.control.explain(input(2, 2, 'south')).find(row => row.entityId === 'guide')!.reason, /转向/);
  updateDungeonAgentMovements(value.agents, .2);
  assert.deepEqual(entry(value, input(2, 2, 'south')), ['direction-back']);
  assert.deepEqual(entry(value, input(2, 4, 'north')), ['direction-front']);
});

test('fixed world sides, shared once keys, independent rule keys and copied action payloads', () => {
  const value = setup();
  for (const [x, y, facing, side] of [[4, 0, 'south', 'north'], [5, 1, 'west', 'east'], [4, 2, 'north', 'south'], [3, 1, 'east', 'west']] as const) {
    assert.deepEqual(entry(value, input(x, y, facing), 'compass'), [`direction-${side}`]);
  }
  const east = value.control.find(input(5, 1, 'west'))[0], west = value.control.find(input(3, 1, 'east'))[0];
  assert.equal(east.onceKey, west.onceKey); assert.equal(east.onceKey, 'entity:compass');
  assert.notEqual(interactionOnceKey({ id: 'a', once: true, onceScope: 'rule' }, 'compass'), interactionOnceKey({ id: 'b', once: true, onceScope: 'rule' }, 'compass'));
  assert.equal(east.action.type, 'dialogue');
  east.action.entryNodeId = 'mutated';
  assert.deepEqual(entry(value, input(5, 1, 'west'), 'compass'), ['direction-east']);
});

test('fallback is entity-local and selected only when no specific rule matches; equal specific rules remain ambiguous', () => {
  const data = source();
  data.components.event.find((row: { id: string }) => row.id === 'guide:direction-front').enabled = false;
  const value = setup(data);
  assert.deepEqual(entry(value, input(2, 2, 'south')), ['direction-fallback']);
  assert.deepEqual(entry(value, input(2, 4, 'north')), ['direction-back']);
  const duplicate = structuredClone(data.components.event.find((row: { id: string }) => row.id === 'guide:direction-back'));
  duplicate.id += '-duplicate'; data.components.event.push(duplicate);
  assert.equal(entry(setup(data), input(2, 4, 'north')).length, 2, 'router still detects explicit priority ties');
});

test('enter uses actual arrival, diagonal ties are clockwise, and wrapping seams preserve side', () => {
  const value = setup();
  const query: InteractionQuery = { ...input(0, 1, 'north'), trigger: 'enter', from: { tileX: 0, tileY: 0 } };
  assert.deepEqual(entry(value, query, 'entry-point'), ['direction-enter-north']);
  query.from = { tileX: 0, tileY: 2 };
  assert.deepEqual(entry(value, query, 'entry-point'), ['direction-enter-other'], 'facing north does not replace the southern arrival');
  assert.equal(relativeInteractionSide('north', 'north-east'), 'front');
  assert.equal(relativeInteractionSide('east', 'north-east'), 'right');
  assert.equal(worldInteractionSide('north-east'), 'east');
  assert.equal(worldInteractionSide('north-west'), 'north');
  const data = source(); data.grid.topologyMode = 'loop';
  const loop = setup(data);
  assert.equal(interactionArrivalSide(loop.runtime.map, { tileX: 0, tileY: 0 }, { tileX: 5, tileY: 0 }), 'west');
  assert.equal(interactionArrivalSide(loop.runtime.map, { tileX: 0, tileY: 0 }, { tileX: 5, tileY: 4 }), 'north-west');
  assert.equal(interactionArrivalSide(loop.runtime.map, query.position, query.position), null);
  const narrow = source(); narrow.grid.width = 2; narrow.grid.topologyMode = 'loop';
  // Use the compiled topology from an otherwise valid document with no entities.
  narrow.entities = []; narrow.components = {};
  const narrowMap = createDungeonRuntime(parseDungeonMapDocumentV3(narrow), { sceneEnvironmentComponent: { mapAnchorMode: 'first-tile', mapOffset: [0, 0, 0], tileSize: [1, 1, 1], tileSpacing: [1, 1] }, tilePosition: { x: 0, y: 0 }, worldPosition: [0, 0, 0] }).map;
  assert.equal(interactionArrivalSide(narrowMap, { tileX: 1, tileY: 0 }, { tileX: 0, tileY: 0 }, 'west'), 'east');
  assert.equal(interactionArrivalSide(narrowMap, { tileX: 1, tileY: 0 }, { tileX: 0, tileY: 0 }, 'east'), 'west');
});

test('blocked-attempt dialogue queries the front target and world rules also work on a shared edge', () => {
  const value = setup();
  assert.deepEqual(entry(value, { ...input(2, 2, 'south'), trigger: 'move-attempt' }), ['direction-bump']);
  const data = source();
  const side = new DungeonMapDocumentQuery(value.document).getSide('tile:1,1', 'east')!;
  data.components['spatial-attachment'].find((row: { entityId: string }) => row.entityId === 'compass').targets = [{ kind: 'edge', edgeId: side.edgeId }];
  const edge = setup(data);
  assert.deepEqual(entry(edge, input(1, 1, 'east'), 'compass'), ['direction-west']);
  assert.deepEqual(entry(edge, input(2, 1, 'west'), 'compass'), ['direction-east']);
  const event = { ...componentDefinition.createDefault(), trigger: 'move-attempt', targetRule: 'self' as const };
  assert.ok(validateInteractionEvent(event).some(message => message.includes('受阻')));
});

test('direction data roundtrips; incomplete drafts are editable and execution rejects absent facing', () => {
  const value = setup();
  assert.deepEqual(validateDungeonMapDocumentV2(value.document), []);
  assert.deepEqual(validateDungeonInteractionDocument(value.document), []);
  assert.deepEqual(encodeDungeonMapDocumentV3(value.document).components.event, source().components.event);
  const draft = componentDefinition.createDefault(); draft.directionSpace = 'target-local'; draft.localSides = [];
  assert.deepEqual(validateInteractionEvent(draft, false), []);
  assert.ok(validateInteractionEvent(draft).length);
  for (const patch of [{ worldSides: ['up'] }, { localSides: ['front', 'front'] }, { onceScope: 'forever' }, { directionSpace: 'camera' }]) {
    assert.ok(validateInteractionEvent({ ...draft, ...patch } as typeof draft, false).length);
  }
  const data = source(); data.components.event.find((row: { id: string }) => row.id === 'compass:direction-north').directionSpace = 'target-local';
  data.components.event.find((row: { id: string }) => row.id === 'compass:direction-north').localSides = ['front'];
  assert.ok(validateDungeonInteractionDocument(parseDungeonMapDocumentV3(data)).some(error => error.includes('朝向')));
  data.components['grid-facing'] = [{ id: 'compass:facing', entityId: 'compass', type: 'grid-facing', version: 1, facing: 'north' }];
  assert.deepEqual(entry(setup(data), input(4, 0, 'south'), 'compass'), ['direction-north']);
});
