import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { createServer } from 'vite';
import { NullEngine, Scene, Vector3 } from '@babylonjs/core';
import { DEFAULT_OVERHEAD_VIEW, resolveOverheadView } from '../../core/dungeon-view/dungeonOverheadView.ts';

const near = (actual, expected) => actual.forEach((value, i) => assert.ok(Math.abs(value - expected[i]) < 1e-4, `${value} != ${expected[i]}`));
test('real factory builds forward references, parent transforms and isolated nested ground display; disposal is complete', async () => {
  const server = await createServer({ configFile: false, server: { middlewareMode: true, hmr: false, ws: false }, optimizeDeps: { noDiscovery: true, include: [] }, resolve: { alias: { '@': path.resolve('.') } }, logLevel: 'error' });
  const engine = new NullEngine(); const scene = new Scene(engine);
  try {
    const { createSceneEnvironment, createSceneEnvironmentAsync } = await server.ssrLoadModule('/core/scene/createSceneEnvironment.ts');
    const { applySceneEnvironmentDisplayView } = await server.ssrLoadModule('/core/dungeon-view/sceneEnvironmentDisplay.ts');
    const preset = { presetKey: 'tree', name: 'Tree', clearColor: '#000000', models: [],
      transformNodes: [
        { id: 'socket', name: 'Socket', parentId: 'transform:rig', position: [1, 0, 0] },
        { id: 'rig', name: 'Rig', position: [10, 0, 20], rotation: [0, Math.PI / 2, 0], scaling: [2, 2, 2] },
      ], objects: [
        { id: 'box', name: 'Box', parentId: 'object:ground', position: [1, 2, 3], color: '#ffffff', geometry: { primitive: 'box', width: 1, height: 1, depth: 1 } },
        { id: 'ground', name: 'Ground', parentId: 'transform:socket', position: [0, 0, 0], scaling: [2, 1, 2], color: '#ffffff', geometry: { primitive: 'ground', width: 10, height: 10 } },
      ], lights: [{ id: 'lamp', name: 'Lamp', parentId: 'transform:socket', intensity: 1, color: '#ffffff', light: { primitive: 'point', position: [0, 1, 0] } }],
    };
    const instance = createSceneEnvironment(scene, preset, { shadowQualityPresets: {} });
    const rig = instance.nodes.get('transform:rig'), socket = instance.nodes.get('transform:socket');
    const box = instance.nodes.get('object:box'), ground = instance.nodes.get('object:ground');
    assert.equal(socket.parent, rig); assert.equal(box.parent, ground); assert.equal(instance.nodes.get('light:lamp').parent, socket);
    const world = node => { node.computeWorldMatrix(true); return node.getAbsolutePosition().asArray(); };
    const original = world(box); const beforeScale = box.getWorldMatrix().getRow(0).length();
    rig.position.x += 5;
    near(world(box), [original[0] + 5, original[1], original[2]]);
    const view = resolveOverheadView({ ...DEFAULT_OVERHEAD_VIEW, proportion: 'manual', scaleX: 2, scaleZ: 3 }, [0, 0, 0], [1, 1, 1]);
    applySceneEnvironmentDisplayView(instance, preset, view);
    near(rig.position.asArray(), [20, 0, 60]); near(socket.position.asArray(), [1, 0, 0]);
    near(world(box), [original[0] + 10, original[1], original[2] + 40]);
    near([box.getWorldMatrix().getRow(0).length()], [beforeScale]);
    near(instance.groundMeshes.get('object:ground').scaling.asArray(), [2, 1, 3]);
    near(ground.scaling.asArray(), [2, 1, 2]);
    applySceneEnvironmentDisplayView(instance, preset, null);
    near(world(box), original); near(instance.groundMeshes.get('object:ground').scaling.asArray(), [1, 1, 1]);
    instance.dispose(); assert.equal(scene.meshes.length, 0); assert.equal(scene.transformNodes.length, 0); assert.equal(scene.lights.length, 0);
    const candidate = await createSceneEnvironmentAsync(scene, preset, { staged: true, shadowQualityPresets: {} });
    assert.equal(candidate.nodes.get('object:box').isEnabled(), false);
    candidate.root.setEnabled(true); assert.equal(candidate.nodes.get('object:box').isEnabled(), true);
    candidate.dispose(); candidate.dispose();
    const invalid = structuredClone(preset); invalid.transformNodes[1].parentId = 'object:box';
    assert.throws(() => createSceneEnvironment(scene, invalid, { shadowQualityPresets: {} }), /循环/);
    assert.equal(scene.transformNodes.length, 0);
  } finally { scene.dispose(); engine.dispose(); await server.close(); }
});
