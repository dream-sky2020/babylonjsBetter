import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { createServer } from 'vite';
import { JSDOM } from 'jsdom';
import { MeshBuilder, NullEngine, Scene, StandardMaterial } from '@babylonjs/core';

test('Lab module follows view publication, UI groups, snapshots, late objects and disposal without input ownership', async () => {
  const server = await createServer({ configFile: false, server: { middlewareMode: true, hmr: false, ws: false },
    optimizeDeps: { noDiscovery: true, include: [] }, resolve: { alias: { '@': path.resolve('.') } }, logLevel: 'error' });
  const dom = new JSDOM('<aside></aside><div id="status"></div>', { url: 'http://localhost/deformation-test' });
  const globals = new Map(); for (const key of ['window', 'document', 'HTMLElement', 'HTMLInputElement', 'HTMLSelectElement', 'Option', 'location', 'localStorage']) {
    globals.set(key, globalThis[key]); globalThis[key] = dom.window[key];
  }
  let engine, scene, labState, cleanup;
  try {
    const { LabUi } = await server.ssrLoadModule('/tools/lab-kit/labUi.ts');
    const { LabState } = await server.ssrLoadModule('/tools/lab-kit/lab-state/LabState.ts');
    const { dungeonVisualDeformationLabModule } = await server.ssrLoadModule('/tools/lab-modules/dungeon/dungeon-visual-deformation/index.ts');
    const { getVisualDeformationRegistry } = await server.ssrLoadModule('/core/render-deformation/visualDeformationRegistry.ts');
    const { meshDeformationMatrices } = await server.ssrLoadModule('/core/render-deformation/deformationMaterial.ts');
    const { DEFAULT_DEFORMATION_SETTINGS } = await server.ssrLoadModule('/core/render-deformation/deformation.ts');
    const { componentDefinitions } = await server.ssrLoadModule('/tools/entity-container-editor/entityDefinitionCatalog.ts');
    assert.ok(componentDefinitions.some(c => c.type === 'visual-deformation'));
    engine = new NullEngine(); scene = new Scene(engine); labState = new LabState();
    const registry = getVisualDeformationRegistry(scene);
    const listeners = new Set(); const events = new Set();
    const configuredView = { config: { pitchDeg: 45, yawDeg: 0, projection: 'orthographic' } };
    const ui = new LabUi(document.querySelector('aside'), document.getElementById('status'));
    const overheadPanel = ui.addPanel('dungeon-overhead-view', '俯视显示');
    let applyTransitionSettings = null;
    const view = { view: configuredView, configuredView, subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
      mountTransitionControl(row, apply) { overheadPanel.content.append(row); applyTransitionSettings = apply; return () => { row.remove(); applyTransitionSettings = null; }; } };
    const services = new Map([['dungeon:overhead-view', view], ['dungeon:map-loader-references', { current: null }]]);
    cleanup = dungeonVisualDeformationLabModule.setup({ scene, engine, services, labState,
      ui,
      communication: { on(_event, fn) { events.add(fn); return () => events.delete(fn); } },
    });
    const service = services.get('dungeon:visual-deformation');
    assert.equal(registry.controlled, true);
    assert.equal(service.settings.enabled, true);
    service.setDraft({ ...structuredClone(DEFAULT_DEFORMATION_SETTINGS), enabled: true, selection: 'rules', rules: [{ selector: 'group', value: 'trees', strength: .6 }] });
    const mesh = MeshBuilder.CreateBox('tree', {}, scene); mesh.material = new StandardMaterial('tree-material', scene);
    registry.register({ id: 'tree:1', kind: 'model', groupId: 'trees', root: mesh, meshes: [mesh] });
    assert.ok(meshDeformationMatrices.has(mesh));
    assert.match(document.querySelector('.lab-deformation-rule-list').textContent, /强度 0\.6/);
    service.setDraft({ ...service.settings, enabled: false });
    assert.equal(registry.controlled, false); assert.equal(meshDeformationMatrices.has(mesh), false);
    [...document.querySelectorAll('button')].find(b => b.textContent === '应用变形草稿').click();
    assert.equal(service.settings.enabled, true); assert.ok(meshDeformationMatrices.has(mesh));
    const snapshot = labState.createSnapshot();
    const strength = document.querySelector('[data-deformation-field="heightScale"]'); strength.value = '2';
    [...document.querySelectorAll('button')].find(b => b.textContent === '应用变形草稿').click(); assert.equal(service.settings.config.heightScale, 2);
    await labState.restore(snapshot); assert.equal(service.settings.config.heightScale, 1);
    assert.throws(() => service.setDraft({ ...service.settings, config: { ...service.settings.config, strength: -1 } }));
    view.view = null; listeners.forEach(fn => fn()); assert.ok(meshDeformationMatrices.has(mesh));
    const restoreOutsideOverhead = document.querySelector('[data-deformation-restore-outside-overhead]');
    assert.equal(restoreOutsideOverhead.closest('[data-lab-panel]')?.dataset.labPanel, 'dungeon-overhead-view');
    assert.ok(![...document.querySelectorAll('label')].some(row => row.textContent.includes('启用物体显示变形')));
    restoreOutsideOverhead.checked = true;
    applyTransitionSettings();
    assert.equal(service.settings.restoreOutsideOverhead, true); assert.equal(meshDeformationMatrices.has(mesh), false);
    assert.equal(registry.controlled, false);
    view.view = { config: { pitchDeg: 30, yawDeg: 0, projection: 'orthographic' } }; listeners.forEach(fn => fn()); assert.ok(meshDeformationMatrices.has(mesh));
    service.setDraft(null); assert.equal(service.settings.enabled, true); assert.ok(meshDeformationMatrices.has(mesh));
    await labState.restore(snapshot); assert.ok(meshDeformationMatrices.has(mesh));
    view.view = null; view.configuredView = null; listeners.forEach(fn => fn());
    assert.equal(registry.controlled, false); assert.equal(meshDeformationMatrices.has(mesh), false);
    cleanup(); cleanup = null;
    assert.equal(registry.controlled, false); assert.equal(meshDeformationMatrices.has(mesh), false); assert.equal(listeners.size, 0); assert.equal(events.size, 0);
    assert.equal(labState.inspect().length, 0); assert.equal(scene.onBeforeActiveMeshesEvaluationObservable.hasObservers(), false);
  } finally {
    cleanup?.(); labState?.dispose(); scene?.dispose(); engine?.dispose(); await server.close(); dom.window.close();
    for (const [key, value] of globals) { if (value === undefined) delete globalThis[key]; else globalThis[key] = value; }
  }
});
