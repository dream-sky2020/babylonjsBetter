import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { createServer } from 'vite';
import { JSDOM } from 'jsdom';
import { NullEngine, Scene } from '@babylonjs/core';
import { createDungeonMapData } from '../map/dungeonMap.create.ts';
import { createEntityContainer } from '../entity/entity.utils.ts';
import { migrateDungeonMapToDocumentV2 } from '../map-document/dungeonMapDocument.migrate.ts';
import { createDungeonRuntimeMap } from '../dungeon-runtime/dungeonRuntimeMap.ts';

test('transition module preserves synchronous step precedence, interaction/PUSH, input locks and cleanup with domain memory', async () => {
  const server = await createServer({ configFile: false, cacheDir: `node_modules/.cache/vite-tests/dungeon-transition-${process.pid}`, server: { middlewareMode: true, hmr: false, ws: false },
    optimizeDeps: { noDiscovery: true, include: [] }, resolve: { alias: { '@': path.resolve('.') } }, logLevel: 'error' });
  const dom = new JSDOM('<aside></aside><div id="status"></div>', { url: 'http://localhost/transition-test' });
  const previous = new Map();
  for (const key of ['window', 'document', 'HTMLElement', 'HTMLInputElement', 'HTMLSelectElement', 'Option', 'location', 'localStorage']) {
    previous.set(key, globalThis[key]); globalThis[key] = dom.window[key];
  }
  let engine, scene, cleanup, steps;
  try {
    const { LabUi } = await server.ssrLoadModule('/labs/kit/labUi.ts');
    const { LabMemoryRegistry } = await server.ssrLoadModule('/labs/kit/shared-memory/LabMemory.ts');
    const { dungeonTransitionLabModule } = await server.ssrLoadModule('/labs/modules/dungeon/dungeon-transition/dungeonTransition.labModule.ts');
    const transitionData = await server.ssrLoadModule('/labs/modules/dungeon/dungeon-transition/dungeonTransition.memory.ts');
    const gridData = await server.ssrLoadModule('/labs/modules/dungeon/dungeon-grid/dungeonGrid.memory.ts');
    const playerData = await server.ssrLoadModule('/labs/modules/dungeon/dungeon-runtime/dungeonRuntime.memory.ts');
    const librariesData = await server.ssrLoadModule('/labs/modules/dungeon/dungeon-libraries/dungeonLibraries.memory.ts');
    const controls = await server.ssrLoadModule('/core/dungeon-transition/dungeonTransitionControl.ts');
    const stepApi = await server.ssrLoadModule('/core/dungeon-player-movement/dungeonPlayerStepEvents.ts');
    const blockedApi = await server.ssrLoadModule('/labs/modules/dungeon/player-movement/playerMovement.blockedAttempt.ts');
    const mapApi = await server.ssrLoadModule('/labs/modules/dungeon/dungeon-map-loader/dungeonMapLoader.protocol.ts');
    const exit = (id, triggers) => ({ id, entityType: 'dungeon-exit', components: [{ id: `${id}-component`, type: 'dungeon-exit', version: 2,
      triggers, targetMapPresetKey: 'next', targetEntranceId: 'main' }] });
    const entrance = { id: 'entrance', entityType: 'dungeon-entrance', components: [{ id: 'entrance-component', type: 'dungeon-entrance', version: 1, entranceId: 'main', facing: 'east' }] };
    const doc = migrateDungeonMapToDocumentV2({ presetKey: 'source', name: 'Source', map: createDungeonMapData({ id: 'source', width: 2, height: 1,
      createTileData: ({ x }) => createEntityContainer(...(x === 0 ? [entrance] : [exit('enter', ['enter'])])),
      createTileEdgeData: ({ x, direction }) => createEntityContainer(...(x === 0 && direction === 'west' ? [exit('interact', ['interact'])]
        : x === 0 && direction === 'north' ? [exit('push', ['move-attempt'])] : [])),
    }) }).document;
    engine = new NullEngine(); scene = new Scene(engine); steps = new stepApi.DungeonPlayerStepEvents();
    const blocked = blockedApi.createDungeonPlayerBlockedAttemptService(), services = new Map(), memory = new LabMemoryRegistry();
    const writer = memory.scope('dungeon-map-loader'), handlers = new Map();
    let active = null, generation = 0, switches = 0, locks = 0, registered = 0, agentRules = 0;
    const events = [];
    const load = (presetKey) => {
      const loadId = ++generation, map = createDungeonRuntimeMap(doc); active = { loadId, map };
      writer.acquire(transitionData.DUNGEON_TRANSITION_DATA_MEMORY).replace(transitionData.createDungeonTransitionData(loadId, presetKey, doc));
      writer.acquire(gridData.DUNGEON_GRID_MEMORY).replace(gridData.createDungeonGridData(loadId, presetKey, map,
        { mapAnchorMode: 'first-tile', mapOffset: [0, 0, 0], tileSpacing: [2, 2], tileSize: [2, 1, 2] }));
      writer.acquire(playerData.DUNGEON_PLAYER_STATE_MEMORY).replace({ loadId, presetKey, playerPosition: { tileX: 0, tileY: 0 },
        playerFacing: 'west', playerWorldPosition: [0, 0, 0], playerWorldRotationY: 0, playerMovement: null });
      handlers.get(mapApi.dungeonMapChangedEvent)?.({ loadId });
    };
    writer.acquire(librariesData.DUNGEON_LIBRARIES_MEMORY).replace({ maps: { next: doc }, environments: {}, shadows: {} });
    services.set(stepApi.DUNGEON_PLAYER_STEP_SERVICE_KEY, steps);
    services.set(blockedApi.PLAYER_MOVEMENT_BLOCKED_ATTEMPT_SERVICE_KEY, blocked);
    services.set(controls.DUNGEON_TRANSITION_CONTROL_SERVICE_KEY, controls.createDungeonTransitionControl(() => active));
    services.set('dungeon:overhead-view', { displayedView: null, subscribe: () => () => {} });
    cleanup = dungeonTransitionLabModule.setup({ scene, services, memory: memory.scope('dungeon-transition'),
      ui: new LabUi(document.querySelector('aside'), document.getElementById('status')),
      keyboard: {
        register() { registered++; return { setEnabled() {}, dispose() { registered--; } }; },
        acquireLock() { locks++; return { release() { locks--; } }; },
      },
      communication: {
        on(event, fn) { handlers.set(event, fn); return () => handlers.delete(event); },
        async publish(event) { events.push(event.name ?? event.id); },
        async request(request, payload) {
          if (request === mapApi.dungeonMapSwitchRequest) { assert.equal(payload.entranceId, 'main'); switches++; load('next'); return { loaded: true }; }
          return { committed: true };
        },
      },
    });
    assert.deepEqual(memory.inspect().filter(entry => entry.modules.includes('dungeon-transition')).map(entry => entry.key).sort(),
      ['dungeon.grid', 'dungeon.libraries', 'dungeon.player-state', 'dungeon.transitions']);
    steps.subscribe('agent-test', 200, () => { agentRules++; });
    load('source');
    const stepped = steps.emit({ loadId: active.loadId, from: { tileX: 0, tileY: 0 }, to: { tileX: 1, tileY: 0 }, facing: 'east' });
    assert.equal(stepped.stopContinuation, true); assert.equal(agentRules, 0); assert.equal(locks, 1);
    await new Promise(resolve => setImmediate(resolve)); assert.equal(switches, 1); assert.equal(locks, 0);
    load('source');
    // Use the named interaction button, independent of Lab panel controls.
    [...document.querySelectorAll('button')].find(button => button.textContent === '触发当前位置 / 前方交互出口').click();
    await new Promise(resolve => setImmediate(resolve)); assert.equal(switches, 2); assert.equal(locks, 0);
    load('source');
    assert.equal(blocked.tryHandle({ direction: 'north', from: { tileX: 0, tileY: 0 }, blockedReason: 'map-boundary' }), true);
    await new Promise(resolve => setImmediate(resolve)); assert.equal(switches, 3); assert.equal(locks, 0);
    assert.equal(events.length, 6);
    cleanup(); cleanup = null; assert.equal(handlers.size, 0); assert.equal(registered, 0);
    assert.equal(document.querySelector('[data-lab-panel="dungeon-transition"]'), null);
  } finally {
    cleanup?.(); steps?.dispose(); scene?.dispose(); engine?.dispose(); await server.close(); dom.window.close();
    for (const [key, value] of previous) { if (value === undefined) delete globalThis[key]; else globalThis[key] = value; }
  }
});
