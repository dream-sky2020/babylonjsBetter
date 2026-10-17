import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { createServer } from 'vite';
import { JSDOM } from 'jsdom';
import { NullEngine, Scene } from '@babylonjs/core';
import { createDungeonMapData } from '../../../../core/map/dungeonMap.create.ts';
import { migrateDungeonMapToDocumentV2 } from '../../../../core/map-document/dungeonMapDocument.migrate.ts';
import { createDungeonRuntime } from '../../../../core/dungeon-runtime/dungeonRuntime.ts';

test('player simulation reuses blocked inspection and defers bounded Debug summaries, including hidden panels', async () => {
  const server = await createServer({ configFile: false, cacheDir: `node_modules/.cache/vite-tests/player-movement-${process.pid}`, server: { middlewareMode: true, hmr: false, ws: false },
    optimizeDeps: { noDiscovery: true, include: [] }, resolve: { alias: { '@': path.resolve('.') } }, logLevel: 'error' });
  const dom = new JSDOM('<aside></aside><div id="status"></div>', { url: 'http://localhost/player-test' });
  const previous = new Map();
  for (const key of ['window', 'document', 'HTMLElement', 'HTMLInputElement', 'HTMLSelectElement', 'Option', 'location', 'localStorage', 'MutationObserver']) {
    previous.set(key, globalThis[key]); globalThis[key] = dom.window[key];
  }
  let engine, scene, assembly, cleanup;
  try {
    const load = file => server.ssrLoadModule(file);
    const { LabUi } = await load('/labs/kit/labUi.ts');
    const { LabMemoryRegistry } = await load('/labs/kit/shared-memory/LabMemory.ts');
    const { playerMovementLabModule } = await load('/labs/modules/dungeon/player-movement/playerMovement.labModule.ts');
    const playerApi = await load('/core/dungeon-player-movement/dungeonPlayerControl.ts');
    const movementApi = await load('/core/dungeon-movement/dungeonMovementControl.ts');
    const assemblyApi = await load('/core/dungeon-runtime/dungeonRuntimeAssembly.ts');
    const gridApi = await load('/labs/modules/dungeon/dungeon-grid/dungeonGrid.memory.ts');
    const stateApi = await load('/labs/modules/dungeon/dungeon-runtime/dungeonRuntime.memory.ts');
    const movementMemoryApi = await load('/labs/modules/dungeon/dungeon-movement/dungeonMovement.memory.ts');
    const protocol = await load('/labs/modules/dungeon/dungeon-map-loader/dungeonMapLoader.protocol.ts');
    engine = new NullEngine(); scene = new Scene(engine); assembly = new assemblyApi.DungeonRuntimeAssembly();
    const services = new Map(), memory = new LabMemoryRegistry(), handlers = new Map(), tasks = new Map();
    const ui = new LabUi(document.querySelector('aside'), document.getElementById('status'));
    let active = null, keyboardOptions;
    services.set(assemblyApi.DUNGEON_RUNTIME_ASSEMBLY_SERVICE_KEY, assembly);
    services.set(playerApi.DUNGEON_PLAYER_CONTROL_SERVICE_KEY, playerApi.createDungeonPlayerControl(() => active));
    services.set(movementApi.DUNGEON_MOVEMENT_CONTROL_SERVICE_KEY, movementApi.createDungeonMovementControl(() => active && ({ loadId: 1, resolver: active.runtime.movementResolver })));
    cleanup = playerMovementLabModule.setup({ scene, services, ui, memory: memory.scope('player-movement'),
      scheduler: { isPaused: false, register(task) { tasks.set(task.phase, task); return () => tasks.delete(task.phase); } },
      communication: { on(event, fn) { handlers.set(event, fn); return () => handlers.delete(event); }, publish: async () => {}, request: async () => ({ committed: true }) },
      keyboard: { register(options) { keyboardOptions = options; return { id: options.id, dispose() {}, setEnabled() {}, setPriority() {}, setIntercept() {}, setPreventDefault() {} }; },
        subscribe: () => () => {}, getConsumer: () => keyboardOptions },
    });
    const layout = { mapAnchorMode: 'first-tile', mapOffset: [0, 0, 0], tileSize: [1, 1, 1], tileSpacing: [1, 1] };
    const doc = migrateDungeonMapToDocumentV2({ presetKey: 'test', name: 'Test', map: createDungeonMapData({ id: 'test', width: 1000, height: 1 }) }).document;
    const runtime = createDungeonRuntime(doc, { sceneEnvironmentComponent: layout, tilePosition: { x: 0, y: 0 }, worldPosition: [0, 0, 0] });
    runtime.movementResolver.externallyDriven=true;
    const simulation={run:delta=>runtime.movementResolver.tick(delta,slice=>assembly.projectSimulation(slice))};
    assembly.prepare(runtime, 1); active = { loadId: 1, runtime, system: assembly.readPreparation(runtime, 'player-movement') };
    const publisher = memory.scope('dungeon-map-loader');
    publisher.acquire(gridApi.DUNGEON_GRID_MEMORY).replace(gridApi.createDungeonGridData(1, 'test', runtime.map, layout));
    publisher.acquire(stateApi.DUNGEON_PLAYER_STATE_MEMORY).replace(stateApi.createDungeonPlayerStateData(1, 'test', runtime));
    runtime.obstacleStates = new Map(Array.from({ length: 5000 }, (_, i) => [`obstacle:${i}`, true]));
    publisher.acquire(stateApi.DUNGEON_OBSTACLE_STATE_MEMORY).replace(stateApi.createDungeonObstacleStateData(1, 'test', runtime));
    publisher.acquire(movementMemoryApi.DUNGEON_MOVEMENT_STATE_MEMORY).replace(movementMemoryApi.createDungeonMovementStateData(1, 'test', runtime.movementResolver.storage));
    handlers.get(protocol.dungeonMapChangedEvent)({ loadId: 1 });
    const json = document.querySelector('.lab-json'), content = json.parentElement;
    runtime.movementResolver.movementReservationsByTile.flatMap = () => assert.fail('Debug must not scan the full tile table');
    runtime.movementResolver.movementReservationsByPoint.flatMap = () => assert.fail('Debug must not scan the full point table');
    for (let i = 0; i < 25; i++) {
      runtime.traversal.registerActor({ id: `agent:${i}`, kind: 'agent', tileIndex: 10 + i * 2, enabled: true, blocksMovement: true, movementProfileId: 'ground' });
      runtime.movementResolver.requestMove({ actorId: `agent:${i}`, direction: 'east', durationSeconds: 1 });
    }
    tasks.get('debug').run(.25);
    const summary = JSON.parse(json.textContent);
    assert.equal(summary.movementResolver.activeMovementCount, 25); assert.equal(summary.movementResolver.activeMoves.length, 20);
    assert.ok(summary.movementResolver.targetReservations.length <= 20);
    assert.equal(summary.obstacleCount, 5000); assert.equal(Object.keys(summary.obstacleStatesPreview).length, 20);
    const before = json.textContent; document.querySelector('[data-move="east"]').click(); simulation.run(.02);
    assert.equal(json.textContent, before, 'movement must not render JSON');
    content.hidden = true; tasks.get('debug').run(.25); assert.equal(json.textContent, before);
    content.hidden = false; await Promise.resolve(); tasks.get('debug').run(.25); assert.notEqual(json.textContent, before);
    // Free moves must not call the separate facade inspect; blocked interception runs once.
    const blocked = services.get('dungeon:player-movement-blocked-attempt'); let intercepted = 0;
    runtime.playerMovement = null; runtime.movementResolver.cancelActor('$dungeon-player');
    runtime.traversal.moveActor('$dungeon-player', 0); runtime.playerPosition = { tileX: 0, tileY: 0 };
    const off = blocked.register(() => { intercepted++; return true; });
    document.querySelector('[data-move="west"]').click(); assert.equal(intercepted, 1); assert.equal(runtime.playerMovement, null); off();
    // The same button can start a group action; simulation projects its live pose
    // without starting another move or leaving a stale blocked-attempt track.
    runtime.traversal.registerActor({ id: 'box', kind: 'dynamic', tileIndex: 1, enabled: true, blocksMovement: true, movementProfileId: 'ground' });
    const box = runtime.traversal.body('box');box.pushable = true;box.onPlayerPush = 'push';
    document.querySelector('[data-move="east"]').click();
    assert.equal(runtime.playerMovement, null);assert.equal(runtime.movementResolver.storage.groups.size, 1);
    simulation.run(.02);assert.equal(runtime.movementResolver.getActiveRequest('$dungeon-player'), undefined);
    simulation.run(2);assert.equal(runtime.playerPosition.tileX, 1);assert.equal(box.logicalPosition.tileX, 2);
    cleanup(); cleanup = null; assert.equal(tasks.size, 0); assert.equal(handlers.size, 0);
  } finally {
    cleanup?.(); assembly?.dispose(); scene?.dispose(); engine?.dispose(); await server.close(); dom.window.close();
    for (const [key, value] of previous) { if (value === undefined) delete globalThis[key]; else globalThis[key] = value; }
  }
});
