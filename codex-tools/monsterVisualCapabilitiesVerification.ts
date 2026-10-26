import { Color3, Scene, Vector3 } from '@babylonjs/core';
import { MonsterVisualRuntime } from '@/core/monster/visual/MonsterVisualRuntime';
import { MonsterMovementController } from '@/core/monster/visual/MonsterMovementController';
import { MonsterAttackController } from '@/core/monster/visual/MonsterAttackController';
import { MonsterHitController } from '@/core/monster/visual/MonsterHitController';
import { MonsterDeathController } from '@/core/monster/visual/MonsterDeathController';
import { MonsterDistanceStripeRules } from '@/core/monster/visual/MonsterDistanceStripeRules';
import type { MonsterVisualLibraries } from '@/labs/modules/monster/monsterVisual.memory';
import type { MonsterMotionPresetLibrary } from '@/core/monster-motion';
import type { MonsterAttackPresetLibrary } from '@/core/monster-attack-motion';
import type { MonsterDeathPresetLibrary } from '@/core/monster-death-motion';
import type { VisualBattlefield } from '@/core/monster/visual/monsterVisual.types';
import { createNumberSprite } from '@/core/sprite/number/createNumberSprite';
import type { NumberSpritePreset } from '@/core/sprite/number/numberSprite.types';
import { createDefaultSpecialStatus3dConfig } from '@/core/special-status/config/specialStatus3dConfig';
import { SpecialStatusPreviewController } from '@/core/special-status/preview/SpecialStatusPreviewController';

export function verifyMonsterVisualCapabilities(parent: Scene, libraries: MonsterVisualLibraries & { movements: MonsterMotionPresetLibrary; attacks: MonsterAttackPresetLibrary; deaths: MonsterDeathPresetLibrary }, source: VisualBattlefield): string[] {
  const check = (condition: unknown, message: string) => { if (!condition) throw new Error(message); };
  const scene = new Scene(parent.getEngine());
  const battlefield = structuredClone(source);
  battlefield.monsters = battlefield.monsters.slice(0, 1);
  const id = battlefield.monsters[0].id;
  const missing = (read: () => unknown) => { let rejected = false; try { read(); } catch { rejected = true; } check(rejected, 'Missing capability was silently enabled'); };
  const empty = () => check(scene.meshes.length === 0 && scene.transformNodes.length === 0, 'Disposed runtime leaked scene objects');
  const runtimes: MonsterVisualRuntime[] = [];
  const create = (capabilities: NonNullable<ConstructorParameters<typeof MonsterVisualRuntime>[1]>['capabilities'] = []) => {
    const runtime = new MonsterVisualRuntime(scene, { capabilities }); runtimes.push(runtime); runtime.sync(battlefield, libraries); return runtime;
  };
  try {
    const base = create();
    check(scene.meshes.length === 4, 'Base-only rendering created unrelated helpers or effects');
    missing(() => base.movement); missing(() => base.attack); missing(() => base.hit); missing(() => base.death); missing(() => base.layout);
    base.update(.5); base.dispose(); empty();

    const hit = create([MonsterHitController]);
    let hits = 0;
    missing(() => hit.movement); missing(() => hit.death);
    check(hit.hit.playMonsterHit(id, { durationMs: 100, shakeAmplitude: .18, shakeFrequency: 18, overlayStrength: .7, color: Color3.Red() }, () => hits++), 'Hit-only runtime rejected a valid hit');
    hit.update(.05); hit.update(.1); hit.update(1);
    check(hits === 1 && scene.meshes.length === 4, 'Hit-only runtime did not complete exactly once');
    const oldHit = hit.hit;
    hit.removeCapability('hit');
    missing(() => hit.hit);
    check(!oldHit.playMonsterHit(id, { durationMs: 100, shakeAmplitude: .18, shakeFrequency: 18, overlayStrength: .7, color: Color3.Red() }), 'Removed capability accepted new work');
    hit.update(1);
    check(hit.renderer.has(id) && scene.meshes.length === 4, 'Removing a capability broke the base renderer');
    hit.dispose(); empty();

    const combined = create([MonsterMovementController, MonsterAttackController, MonsterHitController, MonsterDeathController, MonsterDistanceStripeRules]);
    const move = Object.values(libraries.movements)[0], attack = Object.values(libraries.attacks)[0];
    check(move && attack, 'Missing motion fixtures');
    let movements = 0, attacks = 0;
    const target = { ...battlefield.monsters[0], position: { ...battlefield.monsters[0].position, row: 1 } };
    check(combined.movement.moveMonster(battlefield, target, move, () => movements++), 'Movement did not start');
    combined.update(.01);
    check(combined.attack.playMonsterAttack(id, attack, new Vector3(0, 0, 1), () => attacks++), 'Attack did not start');
    check(!combined.movement.has(id), 'Attack failed to replace movement');
    combined.update(100); combined.update(100);
    check(movements === 0 && attacks === 1, 'Replaced action completed, or completion was duplicated');
    check(!combined.attack.has(id), 'Completed attack retained its active state');

    const rules = { battlefieldId: battlefield.id, name: 'test', rules: [{ id: 'r1', startRow: 2, monsterStripePresetKey: 'test-stripe' }] };
    combined.distanceStripes.setDistanceStripeRules(rules);
    combined.clear(); check(scene.meshes.length === 0, 'Cleared runtime retained instance meshes');
    check(combined.distanceStripes.getDistanceStripeRules(battlefield.id)?.rules.length === 1, 'Clearing instances erased configuration rules');
    combined.sync(battlefield, libraries);
    check(combined.renderer.has(id), 'Runtime could not rebuild after clear');
    const death = Object.values(libraries.deaths)[0];
    check(death && combined.death.playMonsterDeath(id, death), 'Death did not start');
    combined.sync({ ...battlefield, monsters: [] }, libraries);
    combined.update(100);
    check(!combined.renderer.has(id) && scene.meshes.length === 0, 'Removed instance or its effects reappeared');
    combined.dispose(); empty();
    return ['base-only and hit-only assemblies; absent capabilities reject access',
      'shared action coordination replaces movement without duplicate completion',
      'clear preserves rule configuration; removed and disposed instances release effects'];
  } finally { for (const runtime of runtimes) runtime.dispose(); scene.dispose(); }
}

export async function verifyMonsterPreviewDisposal(parent: Scene): Promise<string[]> {
  const preset: NumberSpritePreset = { presetKey: 'disposal-test', name: 'Disposal test', height: 1, spacing: 0, groupingEnabled: false, groupingExtraSpacing: 0,
    alignment: 'center', billboard: false, glyphs: { '1': { type: 'single', imagePath: 'resources/favicon.svg' } } };
  for (const mode of ['number', 'status'] as const) {
    const scene = new Scene(parent.getEngine());
    const preview = mode === 'status' ? new SpecialStatusPreviewController(scene) : null;
    const pending = preview
      ? preview.syncSpecialStatusPreview('test', createDefaultSpecialStatus3dConfig(preset), [1, 1, 1, 1], [true, true, true, true], false)
      : createNumberSprite(scene, '1', preset);
    preview?.dispose(); scene.dispose();
    let timeout: ReturnType<typeof setTimeout> | undefined;
    try {
      await Promise.race([pending, new Promise<never>((_, reject) => { timeout = setTimeout(() => reject(new Error(`${mode} creation hung after scene disposal`)), 3000); })]);
      if (scene.meshes.length || scene.transformNodes.length) throw new Error(`${mode} creation resurrected disposed scene objects`);
    } finally { if (timeout) clearTimeout(timeout); scene.dispose(); }
  }
  return ['pending number and status previews settle without recreating disposed scene objects'];
}
