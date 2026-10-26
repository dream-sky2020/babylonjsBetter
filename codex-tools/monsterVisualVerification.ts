import { MonsterLayoutHelpers } from '@/core/monster';
import { Scene, Vector3 } from '@babylonjs/core';
import { MonsterVisualRuntime } from '@/core/monster';
import { createLab } from '@/labs/kit';
import { monsterLabModuleCatalog, MONSTER_BATTLEFIELD, MONSTER_VISUAL_LIBRARIES, MONSTER_VISUAL_SETTINGS,
  monsterBattlefieldCommand, monsterBattlefieldChanged, monsterVisualCommand, monsterVisualActionChanged, monsterLibrariesReload,
  type MonsterVisualAction } from '@/labs/modules/monster';
import { MONSTER_MOVEMENT_LIBRARY, MONSTER_ATTACK_LIBRARY, MONSTER_DEATH_LIBRARY,
  monsterMovementCommand, monsterAttackCommand, monsterHitCommand, monsterDeathCommand } from '@/labs/modules/monster';
import '@/labs/kit/styles.css';
import { verifyMonsterPreviewDisposal, verifyMonsterVisualCapabilities } from './monsterVisualCapabilitiesVerification';
import { verifyMonsterModuleAssemblies } from './monsterModuleAssemblyVerification';

const result = document.querySelector('#result')!;
const checks: string[] = [];
const fullModules = ['monster-layout-debug', 'monster-distance-stripes', 'monster-movement', 'monster-attack', 'monster-hit', 'monster-death'];
const assert = (condition: unknown, message: string) => { if (!condition) throw new Error(message); };
const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
const until = async (condition: () => boolean) => {
  const deadline = performance.now() + 12000;
  while (!condition()) { if (performance.now() > deadline) throw new Error('Timed out waiting for presentation'); await wait(30); }
};

try {
  checks.push(...await verifyMonsterModuleAssemblies());
  const host = await createLab({ root: document.querySelector('#root') as HTMLElement, title: '怪物视觉回归', description: '', badge: 'Verification',
    modules: fullModules, catalog: monsterLabModuleCatalog,
    initialCamera: { orbitCenter: new Vector3(0, 6, 0), orbitYaw: 0, orbitPitchDeg: 8, orbitRadius: 60, fovDeg: 40 },
  });
  const { context } = host;
  const field = context.memory.acquire(MONSTER_BATTLEFIELD), libraries = context.memory.acquire(MONSTER_VISUAL_LIBRARIES), settings = context.memory.acquire(MONSTER_VISUAL_SETTINGS);
  const movements = context.memory.acquire(MONSTER_MOVEMENT_LIBRARY), attacks = context.memory.acquire(MONSTER_ATTACK_LIBRARY), deaths = context.memory.acquire(MONSTER_DEATH_LIBRARY);
  const events: MonsterVisualAction[] = [];
  context.communication.on(monsterVisualActionChanged, event => { events.push(event); });
  const requestField = (command: import('@/labs/modules/monster').BattlefieldCommand | { kind: 'move'; monsterId: string; row: number; column: number; presetKey: string }) =>
    command.kind === 'move' ? context.communication.request(monsterMovementCommand, command) : context.communication.request(monsterBattlefieldCommand, command);
  const requestVisual = (command: import('@/labs/modules/monster').VisualCommand | { kind: 'attack'; monsterId: string; presetKey: string } | { kind: 'death'; monsterId: string; presetKey: string } | { kind: 'hit'; monsterId: string }) => {
    if (command.kind === 'attack') return context.communication.request(monsterAttackCommand, command);
    if (command.kind === 'death') return context.communication.request(monsterDeathCommand, command);
    if (command.kind === 'hit') return context.communication.request(monsterHitCommand, command);
    return context.communication.request(monsterVisualCommand, command);
  };
  const first = field.require().monsters[0].id;
  const anchor = (id = first) => context.scene.getTransformNodeByName(`movementAnchor_${id}`)!;
  const visual = (id = first) => context.scene.getTransformNodeByName(`placement_${id}_root`)!;
  assert(host.moduleIds.length === 9 && host.moduleIds.every(id => id.startsWith('monster-')), 'Unexpected monster assembly');
  await context.scene.whenReadyAsync();
  assert(context.scene.meshes.filter(m => m.name.startsWith(`placement_${first}_`)).length === 4, 'Expected four layers');
  checks.push('nine explicitly assembled monster modules; real four-layer WebGL rendering');
  checks.push(...verifyMonsterVisualCapabilities(context.scene, { ...libraries.require(), movements: movements.require(), attacks: attacks.require(), deaths: deaths.require() }, field.require()));
  checks.push(...await verifyMonsterPreviewDisposal(context.scene));

  assert(!context.scene.meshes.some(mesh => mesh.name.startsWith('cell_')), 'Hidden helpers allocated grid meshes');
  const gridScene = new Scene(context.scene.getEngine());
  const gridManager = new MonsterVisualRuntime(gridScene, { capabilities: [MonsterLayoutHelpers] });
  try {
    const layout = structuredClone(field.require());
    const resources = { configs: {}, monsterStripes: {}, stripes: {} };
    gridManager.layout.setHelpersVisible(false);
    gridManager.sync(layout, resources, '');
    assert(gridScene.meshes.length === 0 && gridScene.materials.length === 0, 'Hidden grid allocated resources');
    gridManager.layout.setHelpersVisible(true);
    assert(gridScene.meshes.length === layout.width, 'Showing helpers did not build the current grid');
    gridManager.layout.setHelpersVisible(false);
    assert(gridScene.meshes.length === 0 && gridScene.materials.length === 0, 'Hiding helpers leaked grid resources');
    layout.monsters[0].position.row = 100;
    gridManager.sync(layout, resources, '');
    assert(gridScene.meshes.length === 0, 'Hidden layout update allocated grid meshes');
    gridManager.layout.setHelpersVisible(true);
    assert(gridScene.meshes.length === 101 * layout.width, 'Showing helpers used a stale layout');
    gridManager.clear();
    gridManager.layout.setHelpersVisible(true);
    assert(gridScene.meshes.length === 0 && gridScene.materials.length === 0, 'Clear retained a stale helper layout');
  } finally { gridManager.dispose(); gridScene.dispose(); }
  checks.push('hidden helpers allocate no grid; show/hide rebuilds latest layout and releases resources');

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

  const moveKey = Object.keys(movements.require())[0];
  await requestField({ kind: 'move', monsterId: first, row: 2, column: 0, presetKey: moveKey });
  assert(anchor().position.z > -24, 'Movement teleported to destination');
  await until(() => events.some(e => e.monsterId === first && e.kind === 'move' && e.outcome === 'completed'));
  assert(Math.abs(anchor().position.z + 24) < .001, 'Movement did not finish at authoritative layout');
  checks.push('movement animates from the old pose and reaches committed layout');

  const attackKey = Object.keys(attacks.require())[0];
  for (const start of [
    () => requestVisual({ kind: 'attack', monsterId: first, presetKey: attackKey }),
    () => requestField({ kind: 'move', monsterId: first, row: 3, column: 0, presetKey: moveKey }),
  ]) {
    await start();
    settings.current.paused = true;
    const actionId = events.findLast(event => event.monsterId === first && event.outcome === 'started')!.actionId;
    const pose = anchor().position.clone(), root = visual();
    const originalRows = new Map(field.require().monsters.map(monster => [monster.id, monster.position.row]));
    await requestField({ kind: 'add', configKey: sourceConfig.id });
    const added = field.require().monsters.at(-1)!;
    assert(![...originalRows.values()].includes(added.position.row), 'Added monster overlaps an occupied row');
    assert(field.require().monsters.slice(0, -1).every(monster => originalRows.get(monster.id) === monster.position.row), 'Add relocated an existing monster');
    assert(anchor().position.equalsWithEpsilon(pose) && visual() === root, 'Add changed an existing visual or pose');
    assert(!events.some(event => event.actionId === actionId && event.outcome === 'cancelled'), 'Add cancelled another monster action');
    await requestField({ kind: 'remove', monsterId: added.id });
    settings.current.paused = false;
    await until(() => events.some(event => event.actionId === actionId && event.outcome === 'completed'));
  }
  checks.push('adding instances preserves other attacks and movements through completion');

  // Reproduce deleting the middle of rows 0/1/2, then adding again.
  await requestField({ kind: 'patch', monsterId: first, row: 0 });
  const layoutSnapshot = context.labState.createSnapshot();
  await requestField({ kind: 'add', configKey: sourceConfig.id });
  const third = field.require().monsters.at(-1)!;
  assert(third.position.row === 2, 'Initial add did not select the first empty row');
  await requestField({ kind: 'remove', monsterId: second });
  await requestField({ kind: 'add', configKey: sourceConfig.id });
  const replacement = field.require().monsters.at(-1)!;
  assert(replacement.position.row === 1 && field.require().monsters.find(monster => monster.id === third.id)?.position.row === 2,
    'Add after deletion overlapped or relocated an existing monster');
  await requestField({ kind: 'remove', monsterId: replacement.id });
  await requestField({ kind: 'remove', monsterId: third.id });
  await context.labState.restore(layoutSnapshot);
  checks.push('add after deleting a middle instance reuses the first empty row');
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
  for (const presetKey of Object.keys(deaths.require())) {
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
  const restored = await createLab({ root, title: '恢复验证', description: '', badge: 'Verification', modules: fullModules, catalog: monsterLabModuleCatalog, initialState: snapshot });
  assert(restored.context.memory.acquire(MONSTER_BATTLEFIELD).require().monsters.length === 2, 'Initial snapshot was overwritten at start');
  restored.dispose(); checks.push('dispose releases Host; fresh Host restores initial snapshot');
  result.textContent = JSON.stringify({ passed: true, checks });
} catch (error) {
  result.textContent = JSON.stringify({ passed: false, checks, error: error instanceof Error ? error.stack : String(error) });
}
