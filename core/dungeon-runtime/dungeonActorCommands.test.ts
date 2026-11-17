import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { parseDungeonMapDocumentV3 } from '../map-document/dungeonMapDocument.storageV3.ts';
import { createDungeonRuntime } from './dungeonRuntime.ts';
import { executeDungeonActorAction } from './dungeonActorCommands.ts';
import { DungeonAgentSystem } from '../dungeon-agent/dungeonAgentSystem.ts';
import { createDungeonAgentControl } from '../dungeon-agent/dungeonAgentControl.ts';
import { createDefaultDungeonAgentControllerRegistry } from '../dungeon-agent/dungeonAgent.controllers.ts';
import { DungeonPlayerSystem } from '../dungeon-player-movement/dungeonPlayerSystem.ts';
import { createDungeonPlayerControl } from '../dungeon-player-movement/dungeonPlayerControl.ts';
import { resolveDungeonDocumentPlayerSpawn } from '../dungeon-player-spawn/dungeonPlayerSpawn.document.ts';
import { resolveDungeonMapTileWorldLayout } from '../scene/dungeonMapSceneLayout.ts';
import { DungeonPlayerStepEvents } from '../dungeon-player-movement/dungeonPlayerStepEvents.ts';
import { DUNGEON_PLAYER_TARGET_ID, type DungeonActorAction } from '../dungeon-interaction/dungeonActorAction.ts';

const agentId = 'test-push-agent';
const fixture = (x = 3, y = 3) => {
  const document = parseDungeonMapDocumentV3(JSON.parse(fs.readFileSync(new URL('../../config/dungeonMapPresets/dungeon_interaction_test.json', import.meta.url), 'utf8')));
  const scene = JSON.parse(fs.readFileSync(new URL('../../config/sceneEnvironmentPresets/interaction-main-ground.json', import.meta.url), 'utf8'));
  const spawn = resolveDungeonDocumentPlayerSpawn(document, { 'interaction-main-ground': scene });
  const tileWorldLayout = resolveDungeonMapTileWorldLayout(spawn.sceneEnvironmentComponent, document.grid.width, document.grid.height, x, y);
  const runtime = createDungeonRuntime(document, { ...spawn, tilePosition: { x, y }, tileWorldLayout, worldPosition: tileWorldLayout.center });
  const abort = new AbortController();
  const events: string[] = [];
  const playerSteps = new DungeonPlayerStepEvents();
  playerSteps.subscribe('test', 0, event => { events.push('player:' + event.to.tileX + ',' + event.to.tileY); });
  const playerSystem = new DungeonPlayerSystem(runtime, 1, playerSteps);
  const agentSystem = new DungeonAgentSystem(runtime, createDefaultDungeonAgentControllerRegistry(), undefined, intent => {
    if (intent.trigger === 'enter') events.push(intent.actorId + ':' + intent.tileIndex);
  });
  agentSystem.settings.controllersEnabled = false;
  const player = createDungeonPlayerControl(() => ({ runtime, loadId: 1, system: playerSystem })).acquire(1)!;
  const agent = createDungeonAgentControl(() => ({ map: runtime.map, loadId: 1, system: agentSystem })).acquire(1)!;
  const execute = (action: DungeonActorAction) => executeDungeonActorAction(action, {
    runtime, signal: abort.signal, player: () => player, agent: () => agent,
    onTeleport: () => events.push('teleported'),
  });
  return { execute, runtime, agent, playerSystem, abort, events };
};

test('teleport validates occupied and reserved landings, moves the body and agent together, and emits no step', () => {
  const { execute, runtime, agent, events } = fixture();
  const warp = (tileId: string) => execute({ type: 'actor-teleport', targetEntityId: agentId, tileId });
  assert.throws(() => warp('tile:3,3'), /被占用/);
  assert.throws(() => warp('tile:absent'), /没有落点格/);
  const to = 3 * runtime.map.width + 5;
  runtime.traversal.pathReservationsByTile[to].set('guide', 1);
  assert.throws(() => warp('tile:5,3'), /预留/);
  runtime.traversal.pathReservationsByTile[to].delete('guide');
  const body = runtime.traversal.body(agentId)!;
  const state = agent.state.agents[agent.state.agentIndexByEntityId.get(agentId)!]!;
  const old = body.tileIndex;
  runtime.traversal.replaceReservations(agentId, [old, to], 0);
  const facing = state.facing;
  assert.equal(warp('tile:5,3'), true);
  assert.equal(state.tileIndex, to);
  assert.equal(state.facing, facing);
  assert.deepEqual(body.pose, { x: 5, y: 3 });
  assert.equal(runtime.traversal.occupantIdsByTile[old].has(agentId), false);
  assert.equal(runtime.traversal.occupantIdsByTile[to].has(agentId), true);
  assert.equal(runtime.traversal.pathReservationsByTile[to].has(agentId), false);
  assert.deepEqual(events, ['teleported']);
});

test('scripted Agent step resolves only after entering, rejects a busy target, and cancels with the session', async () => {
  const { execute, runtime, agent, abort, events } = fixture();
  const step = () => execute({ type: 'actor-move-step', targetEntityId: agentId, direction: 'east' });
  let resolved = false;
  const pending = Promise.resolve(step()).then(() => { resolved = true; });
  agent.update(.2);
  await Promise.resolve();
  assert.equal(resolved, false);
  assert.throws(() => step(), /仍在执行动作/);
  agent.update(.5);
  await pending;
  assert.equal(runtime.traversal.body(agentId)!.tileIndex, 3 * runtime.map.width + 5);
  assert.deepEqual(events, [agentId + ':' + (3 * runtime.map.width + 5)]);
  const cancelled = Promise.resolve(step());
  abort.abort(new Error('地图已切换'));
  await assert.rejects(cancelled, /地图已切换/);
});

test('scripted player step does not push a blocking Agent and emits the normal enter step when unobstructed', async () => {
  const { execute, runtime, playerSystem, events } = fixture();
  const step = () => execute({ type: 'actor-move-step', targetEntityId: DUNGEON_PLAYER_TARGET_ID, direction: 'east' });
  assert.throws(() => step(), /无法走格/);
  assert.deepEqual(runtime.playerPosition, { tileX: 3, tileY: 3 });
  assert.equal(runtime.traversal.body(agentId)!.tileIndex, 3 * runtime.map.width + 4);
  execute({ type: 'actor-teleport', targetEntityId: DUNGEON_PLAYER_TARGET_ID, tileId: 'tile:2,3' });
  const done = step();
  playerSystem.update(.7);
  assert.equal(await done, true);
  assert.deepEqual(events, ['teleported', 'player:3,3']);
});
