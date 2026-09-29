import test from 'node:test';
import assert from 'node:assert/strict';
import { NullEngine, Scene, TransformNode } from '@babylonjs/core';
import { applyDungeonViewToNode, DEFAULT_OVERHEAD_VIEW, resolveOverheadView } from '../../../../core/dungeon-view/dungeonOverheadView.ts';
import { createDungeonAgentDebugMarker } from './dungeonAgentDebugMarker.ts';

const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-5, `${actual} != ${expected}`);

test('Agent Debug marker follows the same overhead display root while its map pose stays unchanged', () => {
  const engine = new NullEngine();
  const scene = new Scene(engine);
  const displayRoot = new TransformNode('dungeon_agent_display_mapping', scene);
  const marker = createDungeonAgentDebugMarker(scene, 'test', { center: [12, 0, 22], size: [2, 1, 2] }, '#ef4444');
  marker.root.parent = displayRoot;
  try {
    const view = resolveOverheadView({ ...DEFAULT_OVERHEAD_VIEW, pitchDeg: 30 }, [10, 0, 20], [2, 1, 2]);
    applyDungeonViewToNode(displayRoot, view);
    marker.root.computeWorldMatrix(true);
    near(marker.root.absolutePosition.z, 24);
    assert.deepEqual(marker.root.position.asArray(), [12, 0, 22]);

    marker.setPose([14, 0, 24], Math.PI / 2);
    marker.root.computeWorldMatrix(true);
    near(marker.root.absolutePosition.z, 28);
    near(marker.root.rotation.y, Math.PI / 2);

    applyDungeonViewToNode(displayRoot, null);
    marker.root.computeWorldMatrix(true);
    near(marker.root.absolutePosition.z, 24);
    assert.deepEqual(marker.root.position.asArray(), [14, 0, 24]);
  } finally {
    marker.dispose(); displayRoot.dispose(); scene.dispose(); engine.dispose();
  }
});
