import { Vector3 } from '@babylonjs/core';
import { createLab } from '@/labs/kit';
import { monsterLabModuleCatalog, MONSTER_BATTLEFIELD, MONSTER_VISUAL_LIBRARIES, MONSTER_VISUAL_SETTINGS,
  monsterBattlefieldCommand, monsterBattlefieldChanged, monsterVisualCommand, monsterVisualActionChanged, monsterLibrariesReload,
  type MonsterVisualAction } from '@/labs/modules/monster';
import '@/labs/kit/styles.css';

const result = document.querySelector('#result')!;
const checks: string[] = [];
const assert = (condition: unknown, message: string) => { if (!condition) throw new Error(message); };
const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
const until = async (condition: () => boolean) => {
  const deadline = performance.now() + 12000;
  while (!condition()) { if (performance.now() > deadline) throw new Error('Timed out waiting for presentation'); await wait(30); }
};

try {
  const host = await createLab({ root: document.querySelector('#root') as HTMLElement, title: '怪物视觉回归', description: '', badge: 'Verification',
    modules: ['monster-visual-debug'], catalog: monsterLabModuleCatalog,
    initialCamera: { orbitCenter: new Vector3(0, 6, 0), orbitYaw: 0, orbitPitchDeg: 8, orbitRadius: 60, fovDeg: 40 },
  });
  const { context } = host;
  const field = context.memory.acquire(MONSTER_BATTLEFIELD), libraries = context.memory.acquire(MONSTER_VISUAL_LIBRARIES), settings = context.memory.acquire(MONSTER_VISUAL_SETTINGS);
  const events: MonsterVisualAction[] = [];
  context.communication.on(monsterVisualActionChanged, event => { events.push(event); });
  const requestField = (command: import('@/labs/modules/monster').BattlefieldCommand) => context.communication.request(monsterBattlefieldCommand, command);
  const requestVisual = (command: import('@/labs/modules/monster').VisualCommand) => context.communication.request(monsterVisualCommand, command);
  const first = field.require().monsters[0].id;
  const anchor = (id = first) => context.scene.getTransformNodeByName(`movementAnchor_${id}`)!;
  const visual = (id = first) => context.scene.getTransformNodeByName(`placement_${id}_root`)!;
  assert(host.moduleIds.length === 4 && host.moduleIds.every(id => id.startsWith('monster-')), 'Unexpected non-monster modules');
  await context.scene.whenReadyAsync();
  assert(context.scene.meshes.filter(m => m.name.startsWith(`placement_${first}_`)).length === 4, 'Expected four layers');
  checks.push('four monster modules only; real four-layer WebGL rendering');

  const sourceConfig = libraries.require().configs[field.require().monsters[0].monsterConfigKey];
  const baselineScale = visual().scaling.x;
  await requestField({ kind: 'add', configKey: sourceConfig.id });
  const second = field.require().monsters[1].id;
  await requestField({ kind: 'patch', monsterId: first, display: { ...sourceConfig, scene3dScale: 2 } });
  assert(visual().scaling.x !== baselineScale && visual(second).scaling.x === baselineScale, 'Instance override leaked');
  assert(libraries.require().configs[sourceConfig.id].scene3dScale === sourceConfig.scene3dScale, 'Preset was mutated');
  const body = context.scene.getMeshByName(`placement_${first}_body`);
  settings.current.boundingBoxes = true; await requestVisual({ kind: 'refresh' });
  assert(body === context.scene.getMeshByName(`placement_${first}_body`) && body?.showBoundingBox, 'Settings rebuilt mesh');
  await context.communication.publish(monsterBattlefieldChanged, { generation: 0, kind: 'replace' });
  assert(body === context.scene.getMeshByName(`placement_${first}_body`), 'Stale battlefield event rebuilt current scene');
  checks.push('same-preset instances stay independent; settings do not rebuild meshes');

  const moveKey = Object.keys(libraries.require().movements)[0];
  await requestField({ kind: 'move', monsterId: first, row: 2, column: 0, presetKey: moveKey });
  assert(anchor().position.z > -24, 'Movement teleported to destination');
  await until(() => events.some(e => e.monsterId === first && e.kind === 'move' && e.outcome === 'completed'));
  assert(Math.abs(anchor().position.z + 24) < .001, 'Movement did not finish at authoritative layout');
  checks.push('movement animates from the old pose and reaches committed layout');

  const attackKey = Object.keys(libraries.require().attacks)[0];
  await requestVisual({ kind: 'attack', monsterId: first, presetKey: attackKey });
  await wait(100); settings.current.paused = true;
  const pausedPose = visual().position.clone(); await wait(250);
  assert(visual().position.equalsWithEpsilon(pausedPose), 'Presentation advanced while paused');
  const before = field.current;
  let rejected = false;
  try { await requestField({ kind: 'move', monsterId: first, row: 3, column: 0, presetKey: moveKey }); } catch { rejected = true; }
  assert(rejected && field.current === before, 'Paused move changed authoritative state');
  settings.current.paused = false;
  await until(() => events.some(e => e.monsterId === first && e.kind === 'attack' && e.outcome === 'completed'));
  checks.push('pause freezes presentation; rejected move leaves state intact; resume completes');

  await requestVisual({ kind: 'hit', monsterId: first });
  await until(() => events.some(e => e.monsterId === first && e.kind === 'hit' && e.outcome === 'completed'));
  for (const presetKey of Object.keys(libraries.require().deaths)) {
    await requestVisual({ kind: 'death', monsterId: first, presetKey });
    const actionId = events.at(-1)!.actionId;
    await until(() => events.some(e => e.actionId === actionId && e.outcome === 'completed'));
    await requestVisual({ kind: 'reset' });
    assert(context.scene.getMeshByName(`placement_${first}_body`)?.visibility === 1, 'Death reset did not restore visibility');
  }
  checks.push('hit and every configured death preset complete and reset');

  const snapshot = context.labState.createSnapshot();
  await requestField({ kind: 'remove', monsterId: second });
  assert(!context.scene.getTransformNodeByName(`movementAnchor_${second}`), 'Removed instance leaked scene objects');
  await context.labState.restore(snapshot);
  assert(field.require().monsters.length === 2 && settings.current.boundingBoxes, 'Snapshot did not restore shared state');
  const bad = structuredClone(snapshot);
  (bad.modules['monster-battlefield'].battlefield.data as { monsters: unknown[] }).monsters.push(structuredClone(field.require().monsters[0]));
  const committed = field.current;
  rejected = false; try { await context.labState.restore(bad); } catch { rejected = true; }
  assert(rejected && field.current === committed, 'Invalid snapshot partially replaced battlefield');
  checks.push('remove releases scene objects; snapshot restore and atomic rejection');

  await requestVisual({ kind: 'attack', monsterId: first, presetKey: attackKey });
  const actionId = events.at(-1)!.actionId;
  await requestVisual({ kind: 'reset' });
  assert(events.some(e => e.actionId === actionId && e.outcome === 'cancelled'), 'Cancelled action has no terminal result');
  await context.communication.request(monsterLibrariesReload, undefined);
  assert(field.require().monsters.length === 2, 'Reload lost battlefield');
  checks.push('reset emits cancellation; preset reload preserves instances');

  const scene = context.scene;
  host.dispose();
  assert(scene.isDisposed, 'Host did not release scene');
  const root = document.querySelector('#root') as HTMLElement;
  const restored = await createLab({ root, title: '恢复验证', description: '', badge: 'Verification', modules: ['monster-visual-debug'], catalog: monsterLabModuleCatalog, initialState: snapshot });
  assert(restored.context.memory.acquire(MONSTER_BATTLEFIELD).require().monsters.length === 2, 'Initial snapshot was overwritten at start');
  restored.dispose(); checks.push('dispose releases Host; fresh Host restores initial snapshot');
  result.textContent = JSON.stringify({ passed: true, checks });
} catch (error) {
  result.textContent = JSON.stringify({ passed: false, checks, error: error instanceof Error ? error.stack : String(error) });
}
