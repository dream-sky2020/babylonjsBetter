import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { createServer } from 'vite';
import { JSDOM } from 'jsdom';
import { NullEngine, Scene } from '@babylonjs/core';
import { createDungeonMapData } from '../../../../core/map/dungeonMap.create.ts';
import { createEntityContainer } from '../../../../core/entity/entity.utils.ts';
import { migrateDungeonMapToDocumentV2 } from '../../../../core/map-document/dungeonMapDocument.migrate.ts';
import { createDungeonRuntime } from '../../../../core/dungeon-runtime/dungeonRuntime.ts';

test('Agent module publishes shallow live memories, moves through Core and replaces state on map changes', async () => {
  const server = await createServer({ configFile: false, cacheDir: `node_modules/.cache/vite-tests/dungeon-agent-${process.pid}`, server: { middlewareMode: true, hmr: false, ws: false },
    optimizeDeps: { noDiscovery: true, include: [] }, resolve: { alias: { '@': path.resolve('.') } }, logLevel: 'error' });
  const dom = new JSDOM('<aside></aside><div id="status"></div>', { url: 'http://localhost/agent-test' });
  const previous = new Map();
  for (const key of ['window', 'document', 'HTMLElement', 'HTMLInputElement', 'HTMLSelectElement', 'Option', 'location', 'localStorage', 'MutationObserver']) {
    previous.set(key, globalThis[key]); globalThis[key] = dom.window[key];
  }
  let engine, scene, assembly, cleanup, steps;
  try {
    const { LabUi } = await server.ssrLoadModule('/labs/kit/labUi.ts');
    const { LabMemoryRegistry } = await server.ssrLoadModule('/labs/kit/shared-memory/LabMemory.ts');
    const { dungeonAgentLabModule } = await server.ssrLoadModule('/labs/modules/dungeon/dungeon-agent/dungeonAgent.labModule.ts');
    const gridData = await server.ssrLoadModule('/labs/modules/dungeon/dungeon-grid/dungeonGrid.memory.ts');
    const agentData = await server.ssrLoadModule('/labs/modules/dungeon/dungeon-agent/dungeonAgent.memory.ts');
    const controllerData = await server.ssrLoadModule('/labs/modules/dungeon/dungeon-agent/dungeonAgentController.memory.ts');
    const navigationData = await server.ssrLoadModule('/labs/modules/dungeon/dungeon-agent/dungeonAgentNavigation.memory.ts');
    const traversalData = await server.ssrLoadModule('/labs/modules/dungeon/dungeon-traversal/dungeonTraversal.memory.ts');
    const movementData = await server.ssrLoadModule('/labs/modules/dungeon/dungeon-movement/dungeonMovement.memory.ts');
    const controlApi = await server.ssrLoadModule('/core/dungeon-agent/dungeonAgentControl.ts');
    const assemblyApi = await server.ssrLoadModule('/core/dungeon-runtime/dungeonRuntimeAssembly.ts');
    const stepApi = await server.ssrLoadModule('/core/dungeon-player-movement/dungeonPlayerStepEvents.ts');
    const { dungeonMapChangedEvent } = await server.ssrLoadModule('/labs/modules/dungeon/dungeon-map-loader/dungeonMapLoader.protocol.ts');
    const entity = { id: 'guard', name: 'Guard', entityType: 'dungeon-agent', components: [
      { id: 'grid', type: 'grid-agent', version: 1, initialFacing: 'east', blocksMovement: true, actionPeriod: 1, priority: 7, movementProfileId: 'ground' },
      { id: 'controller', type: 'agent-controller', version: 1, controllerId: 'stationary', parameters: {} },
    ] };
    const doc = migrateDungeonMapToDocumentV2({ presetKey: 'test', name: 'Test', map: createDungeonMapData({ id: 'test', width: 3, height: 1,
      createTileData: ({ x }) => x === 0 ? createEntityContainer(entity) : undefined }) }).document;
    const layout = { mapAnchorMode: 'first-tile', mapOffset: [10, 0, 20], tileSize: [2, 1, 2], tileSpacing: [2, 2] };
    engine = new NullEngine(); scene = new Scene(engine); assembly = new assemblyApi.DungeonRuntimeAssembly(); steps = new stepApi.DungeonPlayerStepEvents();
    const services = new Map(), memory = new LabMemoryRegistry(), handlers = new Map(), events = []; let task, debugTask, active = null;
    services.set(assemblyApi.DUNGEON_RUNTIME_ASSEMBLY_SERVICE_KEY, assembly); services.set(stepApi.DUNGEON_PLAYER_STEP_SERVICE_KEY, steps);
    services.set('dungeon:overhead-view', { displayedView: null, subscribe: () => () => {} });
    services.set(controlApi.DUNGEON_AGENT_CONTROL_SERVICE_KEY, controlApi.createDungeonAgentControl(() => active));
    cleanup = dungeonAgentLabModule.setup({ scene, services, memory: memory.scope('dungeon-agent'),
      ui: new LabUi(document.querySelector('aside'), document.getElementById('status')),
      communication: { on(event, fn) { handlers.set(event, fn); return () => handlers.delete(event); }, async publish(event, payload) { events.push(payload); } },
      scheduler: { isPaused: false, register(value) {
        if (value.phase === 'simulation') { task = value; return () => { task = null; }; }
        debugTask = value; return () => { debugTask = null; };
      } },
    });
    const load = loadId => {
      const runtime = createDungeonRuntime(doc, { sceneEnvironmentComponent: layout, tilePosition: { x: 2, y: 0 }, worldPosition: [14, 0, 20] });
      runtime.movementResolver.externallyDriven=true;
      task={run:delta=>runtime.movementResolver.tick(delta,slice=>assembly.projectSimulation(slice))};
      assembly.prepare(runtime, loadId);
      active = { loadId, map: runtime.map, system: assembly.readPreparation(runtime, 'dungeon-agent') };
      memory.scope('dungeon-map-loader').acquire(gridData.DUNGEON_GRID_MEMORY).replace(gridData.createDungeonGridData(loadId, 'test', runtime.map, layout));
      memory.scope('dungeon-map-loader').acquire(traversalData.DUNGEON_TRAVERSAL_STATE_MEMORY).replace(traversalData.createDungeonTraversalStateData(loadId, 'test', runtime.traversal));
      memory.scope('dungeon-map-loader').acquire(movementData.DUNGEON_MOVEMENT_STATE_MEMORY).replace(movementData.createDungeonMovementStateData(loadId, 'test', runtime.movementResolver));
      handlers.get(dungeonMapChangedEvent)({ loadId }); return active.system.state;
    };
    const first = load(1);
    assert.deepEqual(memory.inspect().filter(entry => entry.modules.includes('dungeon-agent')).map(entry => entry.key).sort(), ['dungeon.agent-controller-state', 'dungeon.agent-navigation', 'dungeon.agent-settings', 'dungeon.agent-state', 'dungeon.agents', 'dungeon.grid', 'dungeon.spatial-actions', 'dungeon.spatial-world']);
    assert.equal(services.has('dungeon:agent-runtime'), false);
    const observer = memory.scope('agent-observer');
    const descriptions = observer.acquire(agentData.DUNGEON_AGENTS_MEMORY);
    const states = observer.acquire(agentData.DUNGEON_AGENT_STATE_MEMORY);
    const settings = observer.acquire(controllerData.DUNGEON_AGENT_SETTINGS_MEMORY);
    const controllers = observer.acquire(controllerData.DUNGEON_AGENT_CONTROLLER_MEMORY);
    const navigation = observer.acquire(navigationData.DUNGEON_AGENT_NAVIGATION_MEMORY);
    const firstController = controllers.current.agents.get('guard');
    assert.equal(firstController.source, 'map');
    const controllerSelect = [...document.querySelectorAll('select')].find(select => [...select.options].some(option => option.value === 'stationary'));
    controllerSelect.value = 'stationary'; controllerSelect.dispatchEvent(new dom.window.Event('change'));
    assert.equal(firstController.source, 'runtime-override'); assert.equal(first.agents[0].controllerOverride.controllerId, 'stationary');
    [...document.querySelectorAll('button')].find(button => button.textContent === '恢复地图 Controller 配置').click();
    assert.equal(firstController.source, 'map');
    settings.current.controllersEnabled = false; assert.equal(active.system.settings.controllersEnabled, false);
    const firstRow = states.current.agents.get('guard');
    assert.equal(descriptions.current.agents.get('guard').name, 'Guard');
    assert.equal('binding' in firstRow, false);
    assert.equal(memory.inspect().some(entry => entry.key === 'dungeon.loaded-references'), false);
    document.querySelector('[data-agent-move="east"]').click(); assert.ok(first.agents[0].movement);
    assert.equal(firstRow.movementKind, 'move');
    const json = document.querySelector('pre'); const beforeSimulation = json.textContent;
    task.run(1); assert.equal(first.agents[0].tileIndex, 1); assert.equal(first.agents[0].movement, null);
    assert.equal(json.textContent, beforeSimulation, 'simulation must not serialize the Debug panel');
    assert.equal(debugTask.phase, 'debug'); assert.equal(debugTask.intervalSeconds, .25);
    debugTask.run(.25); assert.notEqual(json.textContent, beforeSimulation);
    assert.equal(firstRow.tileIndex, 1); assert.equal(firstRow.movementKind, null);
    first.agents[0].navigationPlan = { targetTileIndex: 2, tileIndices: [1, 2], directions: ['east'], nextStepIndex: 0, totalCost: 1, visitedCount: 2, planSequence: 1 };
    const profileSelect = [...document.querySelectorAll('select')].find(select => [...select.options].some(option => option.value === 'ground-eight-way'));
    profileSelect.value = 'ground-eight-way'; profileSelect.dispatchEvent(new dom.window.Event('change'));
    assert.equal(first.traversal.actors.get('guard').movementProfileId, 'ground-eight-way');
    assert.equal(first.agents[0].navigationPlan, undefined); assert.equal(navigation.current.agents.get('guard').hasPlan, false);
    document.querySelector('[data-agent-turn="right"]').click(); assert.equal(first.agents[0].movement.kind, 'turn');
    const panelContent = json.parentElement; const beforeHidden = json.textContent;
    panelContent.hidden = true;
    task.run(1); assert.equal(firstRow.movementKind, null);
    debugTask.run(.25); assert.equal(json.textContent, beforeHidden, 'hidden Agent panel must skip rendering');
    panelContent.hidden = false; await Promise.resolve(); debugTask.run(.25); assert.notEqual(json.textContent, beforeHidden);
    const second = load(2); assert.notEqual(second, first); assert.equal(second.agents[0].tileIndex, 0);
    handlers.get(dungeonMapChangedEvent)({ loadId: 1 }); assert.equal(services.has('dungeon:agent-runtime'), false);
    assert.equal(states.current.loadId, 2); assert.notEqual(states.current.agents.get('guard'), firstRow);
    assert.equal(settings.current.loadId, 2); assert.equal(controllers.current.loadId, 2);
    assert.equal(navigation.current.loadId, 2);
    assert.equal(states.current.agents.get('guard').tileIndex, 0);
    assert.ok(events.some(event => event.reason === 'manual-move-started'));
    cleanup(); cleanup = null; assert.equal(handlers.size, 0); assert.equal(assembly.inspectSimulationCount(), 0); assert.equal(services.has('dungeon:agent-runtime'), false);
    assert.equal(descriptions.current, null); assert.equal(states.current, null);
    assert.equal(settings.current, null); assert.equal(controllers.current, null);
    assert.equal(navigation.current, null);
    assert.equal(scene.getTransformNodeByName('dungeon_agent_display_mapping'), null);
    assert.equal(debugTask, null);
  } finally {
    cleanup?.(); steps?.dispose(); assembly?.dispose(); scene?.dispose(); engine?.dispose(); await server.close(); dom.window.close();
    for (const [key, value] of previous) { if (value === undefined) delete globalThis[key]; else globalThis[key] = value; }
  }
});
