import { createLab } from '@/labs/kit';
import { monsterLabModuleCatalog, MONSTER_BATTLEFIELD, MONSTER_VISUAL_SETTINGS, MONSTER_SELECTION,
  MONSTER_MOVEMENT_LIBRARY, MONSTER_MOVEMENT_SETTINGS, MONSTER_HIT_SETTINGS,
  monsterMovementCommand, monsterMovementSettingsCommand, monsterAttackCommand, monsterHitCommand, monsterDeathCommand,
  monsterHitSettingsCommand, monsterLayoutSettingsCommand, monsterDistanceStripeSettingsCommand,
  monsterVisualActionChanged } from '@/labs/modules/monster';
import { MONSTER_VISUAL_SERVICE } from '@/labs/modules/monster/monster-visual/monsterVisual.service';

export async function verifyMonsterModuleAssemblies(): Promise<string[]> {
  const assert = (condition: unknown, message: string) => { if (!condition) throw new Error(message); };
  const checks: string[] = [];
  const scenarios = ['monster-visual', 'monster-hit', 'monster-movement', 'monster-attack', 'monster-death', 'monster-layout-debug', 'monster-distance-stripes'];
  const optionalApis = ['monster-movement-configs', 'monster-attack-configs', 'monster-death-configs', 'monster-battlefield-stripe-rules'];
  for (const moduleId of scenarios) {
    const root = document.createElement('div'); document.body.append(root);
    const reads: string[] = [], originalFetch = window.fetch;
    window.fetch = (input, init) => { reads.push(input instanceof Request ? input.url : String(input)); return originalFetch(input, init); };
    let host: Awaited<ReturnType<typeof createLab>> | undefined;
    try {
      host = await createLab({ root, title: '模块独立装配验证', description: '', badge: 'Verification', modules: [moduleId], catalog: monsterLabModuleCatalog });
      const { context } = host, runtime = context.services.get(MONSTER_VISUAL_SERVICE).runtime;
      const allowedApi = moduleId === 'monster-movement' ? optionalApis[0] : moduleId === 'monster-attack' ? optionalApis[1]
        : moduleId === 'monster-death' ? optionalApis[2] : moduleId === 'monster-distance-stripes' ? optionalApis[3] : '';
      for (const api of optionalApis) if (api !== allowedApi) assert(!reads.some(url => url.includes(api)), moduleId + ' fetched unrelated resource: ' + api);
      assert(host.moduleIds.length === (moduleId === 'monster-visual' ? 3 : 4), moduleId + ' installed extra modules');
      const owners = [...root.querySelectorAll<HTMLElement>('[data-system-owner]')].map(element => element.dataset.systemOwner!)
        .filter(id => id in monsterLabModuleCatalog);
      assert(JSON.stringify(owners) === JSON.stringify(host.moduleIds), 'Panel order differs from normal module setup order');
      for (const [id, command] of [['monster-movement', monsterMovementCommand], ['monster-attack', monsterAttackCommand],
        ['monster-hit', monsterHitCommand], ['monster-death', monsterDeathCommand]] as const) {
        assert(context.communication.hasHandler(command) === (id === moduleId), moduleId + ' has an unrelated action handler');
      }
      assert(!context.scene.meshes.some(mesh => /^(cell_|marker_)/.test(mesh.name)), 'Minimal assembly allocated hidden helpers');
      const field = context.memory.acquire(MONSTER_BATTLEFIELD), first = field.require().monsters[0].id;
      if (moduleId === 'monster-hit') {
        await context.communication.request(monsterHitSettingsCommand, { durationMs: 800, color: '#00ff00' });
        const snapshot = context.labState.createSnapshot();
        await context.communication.request(monsterHitSettingsCommand, { durationMs: 100 });
        await context.labState.restore(snapshot);
        assert(context.memory.acquire(MONSTER_HIT_SETTINGS).current.durationMs === 800, 'Hit settings did not restore');
        assert(root.querySelector<HTMLInputElement>('[data-monster-control="hit-duration"]')?.value === '800', 'Hit UI did not restore');
        const bad = structuredClone(snapshot), before = field.current;
        (bad.modules['monster-hit'].settings.data as { durationMs: number }).durationMs = -1;
        let rejected = false; try { await context.labState.restore(bad); } catch { rejected = true; }
        assert(rejected && field.current === before, 'Invalid action settings partially restored the scene');
        const events: string[] = []; context.communication.on(monsterVisualActionChanged, event => { events.push(event.outcome); });
        await context.communication.request(monsterHitCommand, { monsterId: first });
        runtime.update(1); await Promise.resolve();
        assert(JSON.stringify(events) === JSON.stringify(['started', 'completed']), 'Hit-only assembly did not play once');
      }
      if (moduleId === 'monster-movement') {
        const state = context.memory.acquire(MONSTER_MOVEMENT_SETTINGS), presets = context.memory.acquire(MONSTER_MOVEMENT_LIBRARY);
        await context.communication.request(monsterMovementSettingsCommand, { row: 4, column: 0 });
        const snapshot = context.labState.createSnapshot(); await context.communication.request(monsterMovementSettingsCommand, { row: 2 }); await context.labState.restore(snapshot);
        assert(state.current.row === 4 && root.querySelector<HTMLInputElement>('[data-monster-control="move-row"]')?.value === '4', 'Movement target did not restore');
        const visualSettings = context.memory.acquire(MONSTER_VISUAL_SETTINGS), before = field.current;
        visualSettings.current.paused = true; let rejected = false;
        const command = { monsterId: first, row: 2, column: 0, presetKey: Object.keys(presets.require())[0] };
        try { await context.communication.request(monsterMovementCommand, command); } catch { rejected = true; }
        assert(rejected && field.current === before, 'Paused movement changed layout'); visualSettings.current.paused = false;
        await context.communication.request(monsterMovementCommand, command); runtime.update(100);
        assert(Math.abs(runtime.renderer.getMonsterWorldPosition(first)!.z + 24) < .001, 'Movement-only assembly missed its target');
      }
      if (moduleId === 'monster-layout-debug') {
        await context.communication.request(monsterLayoutSettingsCommand, { visible: true });
        assert(context.scene.meshes.some(mesh => mesh.name.startsWith('cell_')), 'Layout module did not create helpers');
        await context.communication.request(monsterLayoutSettingsCommand, { visible: false });
        assert(!context.scene.meshes.some(mesh => /^(cell_|marker_)/.test(mesh.name)), 'Layout module leaked hidden helpers');
      }
      if (moduleId === 'monster-distance-stripes') {
        await context.communication.request(monsterDistanceStripeSettingsCommand, { enabled: true });
        assert(runtime.distanceStripes.getDistanceStripeRules(field.require().id)?.rules.length, 'Distance module did not bind rules to the current field');
        await context.communication.request(monsterDistanceStripeSettingsCommand, { enabled: false });
        assert(!runtime.distanceStripes.getDistanceStripeRules(field.require().id), 'Disabled distance rules remained active');
      }
      if (moduleId === 'monster-visual') {
        const selectedId = field.require().monsters[0].id;
        await context.labState.restore({ format: 'lab-state', version: 1, createdAt: new Date().toISOString(), modules: {
          'monster-visual-debug': { settings: { version: 1, data: { selectedId, boundingBoxes: true, paused: false } } },
        } });
        assert(context.memory.acquire(MONSTER_SELECTION).current.selectedId === selectedId && context.memory.acquire(MONSTER_VISUAL_SETTINGS).current.boundingBoxes, 'Legacy combined settings did not split into owners');
        assert(!context.labState.createSnapshot().modules['monster-visual-debug'], 'New snapshot still writes removed debug state');
      }
      const scene = context.scene; host.dispose(); host = undefined;
      assert(scene.isDisposed && !root.querySelector('[data-system-owner]'), 'Host dispose left module panels or scene objects');
      checks.push(moduleId + ': independent resources, commands, state and panel order');
    } finally { host?.dispose(); window.fetch = originalFetch; root.remove(); }
  }
  return checks;
}
