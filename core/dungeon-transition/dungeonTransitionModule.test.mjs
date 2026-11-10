import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { createServer } from 'vite';
import { JSDOM } from 'jsdom';
import { NullEngine, Scene, TransformNode } from '@babylonjs/core';
import { createDungeonMapData } from '../map/dungeonMap.create.ts';
import { createEntityContainer } from '../entity/entity.utils.ts';
import { migrateDungeonMapToDocumentV2 } from '../map-document/dungeonMapDocument.migrate.ts';
import { createDungeonRuntimeMap } from '../dungeon-runtime/dungeonRuntimeMap.ts';

test('map modules preserve step precedence, input locks, and loaded visual state cleanup', async () => {
  const server = await createServer({ configFile: false, cacheDir: `node_modules/.cache/vite-tests/dungeon-transition-${process.pid}`, server: { middlewareMode: true, hmr: false, ws: false },
    optimizeDeps: { noDiscovery: true, include: [] }, resolve: { alias: { '@': path.resolve('.') } }, logLevel: 'error' });
  const dom = new JSDOM('<aside></aside><div id="status"></div>', { url: 'http://localhost/transition-test' });
  const previous = new Map();
  for (const key of ['window', 'document', 'HTMLElement', 'HTMLInputElement', 'HTMLSelectElement', 'Option', 'location', 'localStorage']) {
    previous.set(key, globalThis[key]); globalThis[key] = dom.window[key];
  }
  let engine, scene, cleanup, cleanupInteraction, steps;
  try {
    const { LabUi } = await server.ssrLoadModule('/labs/kit/labUi.ts');
    const { LabMemoryRegistry } = await server.ssrLoadModule('/labs/kit/shared-memory/LabMemory.ts');
    const { dungeonTransitionLabModule } = await server.ssrLoadModule('/labs/modules/dungeon/dungeon-transition/dungeonTransition.labModule.ts');
    const { dungeonInteractionLabModule } = await server.ssrLoadModule('/labs/modules/dungeon/dungeon-interaction/dungeonInteraction.labModule.ts');
    const { LAB_MESSAGE_BAR } = await server.ssrLoadModule('/labs/modules/shared/message-bar/messageBar.service.ts');
    const { DUNGEON_VISUAL_OBJECT_CONTROL, dungeonVisualObjectControlLabModule } = await server.ssrLoadModule('/labs/modules/dungeon/dungeon-visual-object-control/dungeonVisualObjectControl.labModule.ts');
    const { dungeonEntityVisualLoaderLabModule } = await server.ssrLoadModule('/labs/modules/dungeon/dungeon-entity-visual-loader/dungeonEntityVisualLoader.labModule.ts');
    const { DUNGEON_MAP_VISUAL_PREPARATION } = await server.ssrLoadModule('/labs/modules/dungeon/dungeon-map-loader/dungeonMapVisualPreparation.ts');
    const assemblyApi = await server.ssrLoadModule('/core/dungeon-runtime/dungeonRuntimeAssembly.ts');
    const transitionData = await server.ssrLoadModule('/labs/modules/dungeon/dungeon-transition/dungeonTransition.memory.ts');
    const gridData = await server.ssrLoadModule('/labs/modules/dungeon/dungeon-grid/dungeonGrid.memory.ts');
    const playerData = await server.ssrLoadModule('/labs/modules/dungeon/dungeon-runtime/dungeonRuntime.memory.ts');
    const librariesData = await server.ssrLoadModule('/labs/modules/dungeon/dungeon-libraries/dungeonLibraries.memory.ts');
    const controls = await server.ssrLoadModule('/core/dungeon-transition/dungeonTransitionControl.ts');
    const interactionControl = await server.ssrLoadModule('/core/dungeon-interaction/dungeonInteractionControl.ts');
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
    services.invoke = (token, method, args) => services.get(token)[method](...args);
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
      handlers.get(mapApi.dungeonMapChangedEvent)?.forEach(listener => listener({ loadId }));
    };
    writer.acquire(librariesData.DUNGEON_LIBRARIES_MEMORY).replace({ maps: { next: doc }, environments: {}, shadows: {} });
    services.set(stepApi.DUNGEON_PLAYER_STEP_SERVICE_KEY, steps);
    services.set(blockedApi.PLAYER_MOVEMENT_BLOCKED_ATTEMPT_SERVICE_KEY, blocked);
    services.set(controls.DUNGEON_TRANSITION_CONTROL_SERVICE_KEY, controls.createDungeonTransitionControl(() => active));
    services.set(interactionControl.DUNGEON_INTERACTION_CONTROL, interactionControl.createDungeonInteractionControl(() => null));
    services.set('dungeon:overhead-view', { displayedView: null, subscribe: () => () => {} });
    services.set(assemblyApi.DUNGEON_RUNTIME_ASSEMBLY_SERVICE_KEY, { isPaused: false, registerPreparation() { return () => {}; } });
    const baseContext = { scene, services, scheduler: { isPaused: false, register() { return () => {}; } },
      viewport: { openHtmlLayer() { const content = document.createElement('div'); return { content, show() {}, hide() {}, dispose() { content.remove(); } }; } },
      ui: new LabUi(document.querySelector('aside'), document.getElementById('status')),
      keyboard: {
        register() { registered++; return { setEnabled() {}, setKeys() {}, dispose() { registered--; } }; },
        acquireLock() { locks++; return { release() { locks--; } }; },
      },
      communication: {
        on(event, fn) { let set = handlers.get(event); if (!set) handlers.set(event, set = new Set()); set.add(fn); return () => { set.delete(fn); if (!set.size) handlers.delete(event); }; },
        async publish(event) { events.push(event.name ?? event.id); },
        async request(request, payload) {
          if (request === mapApi.dungeonMapSwitchRequest) { assert.equal(payload.entranceId, 'main'); switches++; load('next'); return { loaded: true }; }
          return { committed: true };
        },
      },
    };
    services.set(LAB_MESSAGE_BAR, { show() {}, clear() {} });
    services.set(DUNGEON_VISUAL_OBJECT_CONTROL, { setState() {}, getState() {} });
    cleanupInteraction = dungeonInteractionLabModule.setup({ ...baseContext, memory: memory.scope('dungeon-interaction') });
    cleanup = dungeonTransitionLabModule.setup({ ...baseContext, memory: memory.scope('dungeon-transition') });
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
    cleanup(); cleanup = null; cleanupInteraction(); cleanupInteraction = null; assert.equal(handlers.size, 0); assert.equal(registered, 0);
    assert.equal(document.querySelector('[data-lab-panel="dungeon-transition"]'), null);

    let prepareVisuals;
    let visualLoadId = 0;
    services.set(DUNGEON_MAP_VISUAL_PREPARATION, {
      activeLoadId: () => visualLoadId,
      register(prepare) { prepareVisuals = prepare; return () => { prepareVisuals = undefined; }; },
    });
    const disposeVisualLoader = dungeonEntityVisualLoaderLabModule.setup(baseContext);
    const disposeVisualControl = dungeonVisualObjectControlLabModule.setup(baseContext);
    try {
      const visualMap = structuredClone(doc);
      visualMap.entities.push({ id: 'lamp', entityType: 'visual-object' });
      visualMap.components['spatial-attachment'].push({
        id: 'lamp-anchor', entityId: 'lamp', type: 'spatial-attachment', version: 1,
        targets: [{ kind: 'tile', tileId: visualMap.grid.tileIds[0] }],
      });
      visualMap.components['visual-objects'] = [{
        id: 'lamp-objects', entityId: 'lamp', type: 'visual-objects', version: 1,
        objects: [{ name: 'light', kind: 'point-light', offset: [0, 0, 0], color: '#ffe080', intensity: 1, range: 2 }],
      }];
      visualMap.components['visual-state'] = [{
        id: 'lamp-states', entityId: 'lamp', type: 'visual-state', version: 1, initialState: 'off',
        states: [{ id: 'off', enabled: { light: false } }, { id: 'lit', enabled: { light: true } }],
      }];
      const root = new TransformNode('visual-candidate', scene);
      const candidate = { loadId: 90, document: visualMap, root, signal: new AbortController().signal,
        layout: { mapAnchorMode: 'first-tile', mapOffset: [0, 0, 0], tileSpacing: [2, 2], tileSize: [2, 1, 2] } };
      const release = await prepareVisuals(candidate);
      visualLoadId = candidate.loadId;
      const control = services.get(DUNGEON_VISUAL_OBJECT_CONTROL);
      const lamp = scene.lights.find(light => light.name === 'lamp:light');
      assert.equal(lamp.isEnabled(), false);
      control.setState('lamp', 'lit');
      control.setState('lamp', 'lit');
      assert.equal(lamp.isEnabled(), true);
      assert.deepEqual(scene.lights.filter(light => light.name === 'lamp:light'), [lamp]);
      release();
      assert.equal(scene.lights.includes(lamp), false);
      assert.equal(control.getState('lamp'), undefined);
      visualMap.components['visual-state'][0].states[0].enabled.missing = false;
      await assert.rejects(prepareVisuals({ ...candidate, loadId: 91 }), /不存在的视觉对象 missing/);
      assert.equal(scene.lights.some(light => light.name === 'lamp:light'), false);
      root.dispose();
    } finally {
      disposeVisualControl();
      disposeVisualLoader();
    }
  } finally {
    cleanup?.(); cleanupInteraction?.(); steps?.dispose(); scene?.dispose(); engine?.dispose(); await server.close(); dom.window.close();
    for (const [key, value] of previous) { if (value === undefined) delete globalThis[key]; else globalThis[key] = value; }
  }
});
