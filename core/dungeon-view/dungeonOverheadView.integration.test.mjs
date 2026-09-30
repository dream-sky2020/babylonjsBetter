import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { createServer } from 'vite';
import { JSDOM } from 'jsdom';
import { ArcRotateCamera, MeshBuilder, NullEngine, Scene, TransformNode, Vector3 } from '@babylonjs/core';
import { createCameraLabController } from '../camera/cameraLabController.ts';
import { createDungeonMapData } from '../map/dungeonMap.create.ts';
import { migrateDungeonMapToDocumentV2 } from '../map-document/dungeonMapDocument.migrate.ts';
import { createDungeonRuntime } from '../dungeon-runtime/dungeonRuntime.ts';
import { startDungeonPlayerMovement } from '../dungeon-player-movement/dungeonPlayerMovement.ts';
import { DEFAULT_OVERHEAD_VIEW } from './dungeonOverheadView.ts';

const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-5, `${a} != ${b}`);
test('real camera, movement marker, grid and obstacle modules share optional view, restore across modes/maps and release', async () => {
  const server = await createServer({ configFile: false, server: { middlewareMode: true, hmr: false, ws: false },
    optimizeDeps: { noDiscovery: true, include: [] }, resolve: { alias: { '@': path.resolve('.') } }, logLevel: 'error' });
  const dom = new JSDOM('<!doctype html><canvas></canvas><aside></aside><div id="status"></div>', { url: 'http://localhost/overhead-test' });
  const previous = new Map();
  for (const key of ['window', 'document', 'HTMLElement', 'HTMLInputElement', 'HTMLSelectElement', 'HTMLTextAreaElement', 'Option', 'location', 'localStorage', 'MutationObserver']) {
    previous.set(key, globalThis[key]); globalThis[key] = dom.window[key];
  }
  previous.set('ResizeObserver', globalThis.ResizeObserver); globalThis.ResizeObserver = class { observe() {} disconnect() {} };
  let engine, scene, c, keyboard, labState, viewport;
  const cleanups = [];
  try {
    const { LabUi } = await server.ssrLoadModule('/tools/lab-kit/labUi.ts');
    const { LabState } = await server.ssrLoadModule('/tools/lab-kit/lab-state/LabState.ts');
    const { LabKeyboardRouter } = await server.ssrLoadModule('/tools/lab-kit/keyboard/LabKeyboardRouter.ts');
    const { LabViewportManager } = await server.ssrLoadModule('/tools/lab-kit/labViewportManager.ts');
    const { dungeonLabModuleCatalog: catalog } = await server.ssrLoadModule('/tools/lab-modules/dungeon/index.ts');
    const { getVisualDeformationRegistry } = await server.ssrLoadModule('/core/render-deformation/visualDeformationRegistry.ts');
    const { applySceneEnvironmentDisplayView } = await server.ssrLoadModule('/core/dungeon-view/sceneEnvironmentDisplay.ts');
    const { createDungeonViewConsumer } = await server.ssrLoadModule('/core/dungeon-view/dungeonOverheadView.ts');
    const { DungeonRuntimeAssembly, DUNGEON_RUNTIME_ASSEMBLY_SERVICE_KEY } = await server.ssrLoadModule('/core/dungeon-runtime/dungeonRuntimeAssembly.ts');
    const definitions = await server.ssrLoadModule('/tools/entity-container-editor/entityDefinitionCatalog.ts');
    const viewEntity = definitions.entityTypeRegistry.get('dungeon-overhead-view');
    assert.deepEqual(viewEntity.allowedContainers, ['map']);
    const declared = definitions.createEntityFromDefinition(viewEntity);
    assert.equal(declared.components[0].pitchDeg, 45);
    const { dungeonMapChangedEvent } = await server.ssrLoadModule('/tools/lab-modules/dungeon/dungeon-map-loader/dungeonMapLoader.protocol.ts');
    engine = new NullEngine(); scene = new Scene(engine); keyboard = new LabKeyboardRouter(null); labState = new LabState();
    const deformationRegistry = getVisualDeformationRegistry(scene);
    const camera = new ArcRotateCamera('camera', 1, 1, 40, Vector3.Zero(), scene); c = createCameraLabController(camera);
    const canvas = document.querySelector('canvas'); canvas.hasPointerCapture = () => false;
    viewport = new LabViewportManager(document.body, canvas, c, () => {});
    const refs = { current: null }; const services = new Map([['dungeon:map-loader-references', refs]]);
    const assembly = new DungeonRuntimeAssembly(); services.set(DUNGEON_RUNTIME_ASSEMBLY_SERVICE_KEY, assembly);
    cleanups.push(() => assembly.dispose());
    const environmentRoot = new TransformNode('scene_environment_test', scene);
    const environmentBox = MeshBuilder.CreateBox('scene-box', { size: 2 }, scene); environmentBox.parent = environmentRoot;
    const environmentPreset = { objects: [{ id: 'box', position: [12, 0, 24], geometry: { primitive: 'box' } }], models: [], lights: [] };
    const environmentInstance = { root: environmentRoot, nodes: new Map([['object:box', environmentBox]]) };
    const environmentConsumer = createDungeonViewConsumer(view => applySceneEnvironmentDisplayView(environmentInstance, environmentPreset, view));
    services.set('dungeon:scene-environment:view', environmentConsumer);
    cleanups.push(() => environmentConsumer.dispose());
    const handlers = new Map();
    const communication = {
      on(event, fn) { const set = handlers.get(event) ?? new Set(); set.add(fn); handlers.set(event, set); return () => { set.delete(fn); if (!set.size) handlers.delete(event); }; },
      publish: async () => {}, request: async () => {},
    };
    const scheduler = { isPaused: false, register: () => () => {} };
    const context = { engine, scene, canvas, camera, cameraController: c, keyboard, labState, viewport, services, communication, scheduler,
      ui: new LabUi(document.querySelector('aside'), document.getElementById('status')) };
    for (const id of ['dungeon-player-camera', 'dungeon-traversal', 'dungeon-movement', 'player-movement', 'dungeon-grid', 'dungeon-obstacle', 'dungeon-overhead-view', 'dungeon-visual-deformation']) {
      const lifecycle = catalog[id].setup(context);
      cleanups.push(typeof lifecycle === 'function' ? lifecycle : () => lifecycle?.dispose?.());
    }
    const coordinator = services.get('dungeon:overhead-view'); const playerCamera = services.get('dungeon:player-camera');
    const environment = { tileSize: [2, 1, 2], tileSpacing: [2, 2], mapOffset: [10, 0, 20], mapAnchorMode: 'first-tile' };
    const map = createDungeonMapData({ id: 'test', width: 4, height: 4 });
    const mapDocument = migrateDungeonMapToDocumentV2({ presetKey: 'test', name: 'test', map }).document;
    const spawn = { sceneEnvironmentComponent: environment, tilePosition: { x: 1, y: 1 }, worldPosition: [12, 0, 22] };
    const runtime = createDungeonRuntime(mapDocument, spawn);
    assembly.prepare(runtime, 1);
    // Exercise all debug children, including edge and reservation layers.
    runtime.traversal.pathReservationsByTile[5].set('test', 1);
    runtime.movementResolver.movementReservationsByTile[5].set('test', 'request');
    const obstacles = [
      { entity: { id: 'wall' }, component: {}, placement: { kind: 'tile-edge', tileX: 1, tileY: 1, direction: 'north' } },
      { entity: { id: 'block' }, component: {}, placement: { kind: 'tile', tileX: 2, tileY: 2 } },
    ];
    refs.current = { document: mapDocument, runtime, loadId: 1, map, spawn, sceneBinding: { component: environment }, obstacles };
    const emitMap = () => handlers.get(dungeonMapChangedEvent)?.forEach(fn => fn({ loadId: refs.current.loadId }));
    emitMap();
    services.get('dungeon-grid-debug:view').setVisible(true); services.get('dungeon-obstacle:view').setVisible(true);
    assert.equal(coordinator.view, null); assert.equal(playerCamera.mode, 'first-person');
    c.setVerticalFovDeg(73);
    const playerData = JSON.stringify({ p: runtime.playerPosition, w: runtime.playerWorldPosition, y: runtime.playerWorldRotationY, m: runtime.playerMovement });
    coordinator.setDraft({ ...DEFAULT_OVERHEAD_VIEW, pitchDeg: 30, orthographicSize: 11 });
    assert.equal(services.get('dungeon:visual-deformation').settings.enabled, true);
    assert.equal(deformationRegistry.controlled, true);
    assert.equal(coordinator.configuredView.config.pitchDeg, 30);
    near(coordinator.view.scaleZ, 2); assert.equal(camera.mode, ArcRotateCamera.ORTHOGRAPHIC_CAMERA); near(camera.orthoTop, 11);
    near(camera.getTarget().z, 24); near(c.state.orbitPitchDeg, 30);
    const roots = () => ['player_display_mapping', `dungeon_grid_debug_${refs.current.loadId}`, `obstacle_debug_${refs.current.loadId}`].map(name => scene.getTransformNodeByName(name));
    for (const root of roots()) { assert.ok(root); near(root.scaling.z, 2); near(root.position.z, -20); }
    near(environmentBox.position.z, 28); near(environmentBox.scaling.z, 1);
    const marker = scene.getTransformNodeByName('composable_player_pose'); assert.ok(marker); marker.computeWorldMatrix(true); near(marker.absolutePosition.z, 24);
    assert.ok(scene.getMeshByName('obstacle_1_wall'));
    for (const mesh of roots()[2].getChildMeshes()) { mesh.computeWorldMatrix(true); near(mesh.absolutePosition.z, 20 + (mesh.position.z - 20) * 2); }
    assert.equal(JSON.stringify({ p: runtime.playerPosition, w: runtime.playerWorldPosition, y: runtime.playerWorldRotationY, m: runtime.playerMovement }), playerData);
    engine.getRenderWidth = () => 400; engine.getRenderHeight = () => 800; engine.onResizeObservable.notifyObservers(engine);
    near(camera.orthoRight, 5.5); near(camera.orthoTop, 11);
    const saved = labState.createSnapshot(); assert.equal(saved.modules['dungeon-overhead-view'].settings.data.draft.pitchDeg, 30);
    const move = startDungeonPlayerMovement(runtime, 'east', { movementTimingMode: 'world-units-per-second', movementSpeed: 6,
      resolveWorldPosition: position => [10 + position.tileX * 2, 0, 20 + position.tileY * 2] });
    assert.equal(move.started, true);
    const movingState = runtime.playerMovement; const movingData = JSON.stringify(movingState);
    const pitchInput = document.querySelector('[data-overhead-field="pitchDeg"]'); pitchInput.value = '45';
    [...document.querySelectorAll('button')].find(b => b.textContent === '应用测试草稿').click(); near(coordinator.view.scaleZ, Math.SQRT2);
    await labState.restore(saved); near(coordinator.view.scaleZ, 2);
    assert.equal(runtime.playerMovement, movingState); assert.equal(JSON.stringify(runtime.playerMovement), movingData);
    assert.throws(() => coordinator.setDraft({ ...DEFAULT_OVERHEAD_VIEW, pitchDeg: 0 })); near(coordinator.view.scaleZ, 2);
    const overlay = viewport.openHtmlLayer({ id: 'pause', title: 'Pause', mode: 'overlay' }); overlay.show();
    keyboard.route({ phase: 'keydown', code: 'KeyV', key: 'v', repeat: false, targetKind: 'canvas' }); assert.equal(playerCamera.mode, 'overhead');
    overlay.hide(); playerCamera.setMode('first-person'); assert.equal(coordinator.view, null);
    assert.equal(coordinator.configuredView.config.pitchDeg, 30);
    roots().forEach(root => { near(root.scaling.z, 2); near(root.position.z, -20); });
    near(environmentBox.position.z, 28);
    near(c.activeCamera.position.z, 24); near(c.activeCamera.fov, 73 * Math.PI / 180);
    coordinator.setDraft({ ...DEFAULT_OVERHEAD_VIEW, pitchDeg: 30, orthographicSize: 11, restoreDisplayInFirstPerson: true });
    roots().forEach(root => { near(root.scaling.z, 1); near(root.position.z, 0); }); near(c.activeCamera.position.z, 22);
    near(environmentBox.position.z, 24);
    coordinator.setDraft({ ...DEFAULT_OVERHEAD_VIEW, pitchDeg: 30, orthographicSize: 11 });
    roots().forEach(root => near(root.scaling.z, 2)); near(c.activeCamera.position.z, 24);
    const overheadPanel = document.querySelector('[data-lab-panel="dungeon-overhead-view"]');
    const displayRestore = [...overheadPanel.querySelectorAll('label')].find(row => row.textContent.includes('格子与玩家显示原比例')).querySelector('input');
    const deformationRestore = overheadPanel.querySelector('[data-deformation-restore-outside-overhead]');
    assert.ok(deformationRestore);
    deformationRestore.checked = true; deformationRestore.dispatchEvent(new dom.window.Event('change'));
    assert.equal(services.get('dungeon:visual-deformation').settings.restoreOutsideOverhead, true);
    keyboard.route({ phase: 'keydown', code: 'KeyV', key: 'v', repeat: false, targetKind: 'canvas' });
    assert.equal(playerCamera.mode, 'overhead'); assert.equal(deformationRestore.checked, true);
    keyboard.route({ phase: 'keydown', code: 'KeyV', key: 'v', repeat: false, targetKind: 'canvas' });
    assert.equal(playerCamera.mode, 'first-person'); assert.equal(deformationRestore.checked, true);
    assert.equal(deformationRegistry.controlled, false);
    deformationRestore.checked = false; deformationRestore.dispatchEvent(new dom.window.Event('change'));
    assert.equal(services.get('dungeon:visual-deformation').settings.restoreOutsideOverhead, false);
    assert.equal(deformationRegistry.controlled, true);
    const applyOverhead = [...overheadPanel.querySelectorAll('button')].find(button => button.textContent === '应用测试草稿');
    displayRestore.checked = true; deformationRestore.checked = true; applyOverhead.click();
    assert.equal(coordinator.configuredView.config.restoreDisplayInFirstPerson, true);
    assert.equal(services.get('dungeon:visual-deformation').settings.restoreOutsideOverhead, true);
    assert.equal(deformationRegistry.controlled, false);
    roots().forEach(root => near(root.scaling.z, 1));
    displayRestore.checked = false; deformationRestore.checked = false; applyOverhead.click();
    assert.equal(services.get('dungeon:visual-deformation').settings.restoreOutsideOverhead, false);
    assert.equal(deformationRegistry.controlled, true);
    roots().forEach(root => near(root.scaling.z, 2));
    playerCamera.setMode('overhead'); near(coordinator.view.scaleZ, 2);
    const bindingToggle = [...document.querySelectorAll('label')].find(row => row.textContent.includes('绑定相机到玩家')).querySelector('input');
    bindingToggle.checked = false; bindingToggle.dispatchEvent(new dom.window.Event('change'));
    assert.equal(coordinator.view, null); roots().forEach(root => near(root.scaling.z, 1));
    assert.equal(camera.mode, ArcRotateCamera.PERSPECTIVE_CAMERA); near(camera.getTarget().z, 22);
    bindingToggle.checked = true; bindingToggle.dispatchEvent(new dom.window.Event('change')); near(coordinator.view.scaleZ, 2);
    coordinator.setEnabled(false); assert.equal(coordinator.configuredView, null);
    assert.equal(services.get('dungeon:visual-deformation').settings.enabled, true);
    assert.equal(deformationRegistry.controlled, false);
    assert.equal(playerCamera.mode, 'first-person'); roots().forEach(root => near(root.scaling.z, 1));
    coordinator.setEnabled(true); near(coordinator.view.scaleZ, 2); assert.equal(deformationRegistry.controlled, true);
    // Rebuilt consumer resources consume the same mapping with a new map origin.
    const nextEnvironment = { ...environment, mapOffset: [0, 0, 0] };
    refs.current = { ...refs.current, loadId: 2, spawn: { ...spawn, sceneEnvironmentComponent: nextEnvironment }, sceneBinding: { component: nextEnvironment } };
    assembly.prepare(runtime, 2);
    emitMap(); roots().forEach(root => { near(root.scaling.z, 2); near(root.position.z, 0); }); near(camera.getTarget().z, 44);
    coordinator.setDraft(null); assert.equal(coordinator.view, null); roots().forEach(root => near(root.scaling.z, 1));
    // Formal map declarations use the same interface; removed/invalid declarations cannot leak across maps.
    const configuredMap = createDungeonMapData({ id: 'configured', width: 4, height: 4,
      createMapData: () => ({ entities: [declared] }) });
    refs.current = { ...refs.current, document: migrateDungeonMapToDocumentV2({ presetKey: 'configured', name: 'configured', map: configuredMap }).document };
    emitMap(); near(coordinator.view.config.pitchDeg, 45);
    refs.current.document.components['dungeon-overhead-view'][0].pitchDeg = 0;
    emitMap(); assert.equal(coordinator.view, null); roots().forEach(root => near(root.scaling.z, 1));
    refs.current = { ...refs.current, document: mapDocument }; emitMap();
    // An existing overhead projection and independent FOV survive temporary control.
    playerCamera.setMode('overhead'); c.setVerticalFovDeg(57); c.setProjection('orthographic'); c.setOrthographicSize(9);
    scene.onBeforeRenderObservable.notifyObservers(scene);
    coordinator.setDraft({ ...DEFAULT_OVERHEAD_VIEW }); coordinator.setDraft(null);
    assert.equal(playerCamera.mode, 'overhead'); near(camera.orthoTop, 9); near(camera.fov, 57 * Math.PI / 180);
    playerCamera.setMode('first-person');
    coordinator.setDraft({ ...DEFAULT_OVERHEAD_VIEW });
    const cleanupDeformation = cleanups.pop(); cleanupDeformation();
    const cleanupCoordinator = cleanups.pop(); cleanupCoordinator();
    roots().forEach(root => near(root.scaling.z, 1)); near(environmentBox.position.z, 24); assert.equal(playerCamera.mode, 'first-person');
    while (cleanups.length) cleanups.pop()();
    assert.equal(handlers.size, 0); assert.equal(labState.inspect().length, 0);
    assert.equal(scene.getTransformNodeByName('player_display_mapping'), null);
    assert.equal(scene.onBeforeRenderObservable.hasObservers(), false);
  } finally {
    while (cleanups.length) cleanups.pop()();
    viewport?.dispose(); c?.dispose(); keyboard?.dispose(); labState?.dispose(); scene?.dispose(); engine?.dispose();
    await server.close(); dom.window.close();
    for (const [key, value] of previous) { if (value === undefined) delete globalThis[key]; else globalThis[key] = value; }
  }
});
