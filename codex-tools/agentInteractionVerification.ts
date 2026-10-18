import { createLab } from '../labs/kit';
import { dungeonLabModuleCatalog } from '../labs/modules/dungeon';
import { DungeonRuntimeAssembly } from '../core/dungeon-runtime/dungeonRuntimeAssembly';
import { setDungeonRuntimePlayerPosition } from '../core/dungeon-runtime/dungeonRuntime';
import { DungeonPlayerSystem } from '../core/dungeon-player-movement/dungeonPlayerSystem';
import type { DungeonPlayerMovementResult } from '../core/dungeon-player-movement/dungeonPlayerMovement';
import { dungeonMapSwitchRequest } from '../labs/modules/dungeon/dungeon-map-loader/dungeonMapLoader.protocol';
import type { DungeonRuntime } from '../core/dungeon-runtime/dungeonRuntime.types';
import '../labs/kit/styles.css';

function assert(value: unknown, message: string): asserts value { if (!value) throw new Error(message); }
const settle = () => new Promise(resolve => setTimeout(resolve, 0));
const same = (a: readonly number[], b: readonly number[]) => a.length === b.length && a.every((v, i) => Math.abs(v - b[i]) < 1e-6);

async function run() {
  let runtime: DungeonRuntime | undefined;
  let assembly: DungeonRuntimeAssembly | undefined;
  // Verification-only capture; production entries keep their service boundaries.
  const prepare = DungeonRuntimeAssembly.prototype.prepare;
  DungeonRuntimeAssembly.prototype.prepare = function (next, loadId) {
    runtime = next; assembly = this; return prepare.call(this, next, loadId);
  };
  try {
    const host = await createLab({ root: document.querySelector<HTMLElement>('#root')!, title: 'Agent interaction verification', description: '', badge: '',
      modules: ['dungeon-config', 'dungeon-transition', 'dungeon-agent', 'dungeon-visual-deformation'], catalog: dungeonLabModuleCatalog });
    host.context.engine.stopRenderLoop();
    try {
      const configurations = [];
      for (const presetKey of ['dungeon_map', 'dungeon_map_2']) {
        await host.context.communication.request(dungeonMapSwitchRequest, { presetKey });
        const agents = [...runtime!.traversal.spatial.bodies.values()].filter(body => body.kind === 'agent');
        assert(agents.length === (presetKey === 'dungeon_map' ? 4 : 10), 'Unexpected Agent count');
        assert(agents.every(body => body.onPlayerPush === 'swap' && body.mobility === 'movable' && body.blocksMovement), 'Runtime configuration mismatch');
        configurations.push({ presetKey, agents: agents.length, response: 'swap' });
      }
      const r = runtime!, a = assembly!;
      const toggle = [...document.querySelectorAll<HTMLInputElement>('input')].find(input => input.parentElement?.textContent?.includes('启用 Agent Controller'));
      assert(toggle, 'Controller toggle missing');
      toggle.checked = false; toggle.dispatchEvent(new Event('change'));
      const body = r.traversal.body('agent:plaza:friendly-guard')!;
      const marker = host.context.scene.transformNodes.find(node => node.name.startsWith('dungeon_agent_debug_') && node.name.endsWith('agent_plaza_friendly-guard'))!;
      const playerMarker = host.context.scene.getTransformNodeByName('composable_player_pose')!;
      assert(marker && playerMarker, 'Real visual nodes missing');
      const system = a.readPreparation<DungeonPlayerSystem>(r, 'player-movement');
      const results = [];
      for (const response of ['swap', 'push', 'block'] as const) {
        toggle.checked = response === 'swap'; toggle.dispatchEvent(new Event('change'));
        body.onPlayerPush = response; // Disposable session only; no preset writes.
        const targetFrom = { ...body.logicalPosition };
        const from = { tileX: targetFrom.tileX - 1, tileY: targetFrom.tileY };
        setDungeonRuntimePlayerPosition(r, from);
        r.playerWorldPosition = r.movementResolver.worldPositionFor!(from.tileX, from.tileY);
        r.playerFacing = 'east'; r.playerWorldRotationY = Math.PI / 2;
        let result: DungeonPlayerMovementResult | undefined;
        const original = system.move, relative = system.moveRelative;
        system.move = function (...args) { const outcome = original.apply(this, args); result = outcome; return outcome; };
        system.moveRelative = function (...args) { const outcome = relative.apply(this, args); result = outcome; return outcome; };
        try {
          document.querySelector<HTMLButtonElement>(response === 'push' ? '[data-relative-move="forward"]' : '[data-move="east"]')!.click();
        } finally { system.move = original; system.moveRelative = relative; }
        assert(result, 'UI did not submit a player command');
        if (response === 'block') {
          assert(result.blockedReason === 'movement-obstacle' && !result.actionKind, 'Block response started an interaction');
          r.movementResolver.tick(1, delta => a.projectSimulation(delta));
          assert(r.playerPosition.tileX === from.tileX && body.logicalPosition.tileX === targetFrom.tileX, 'Block changed anchors');
        } else {
          assert(result.actionKind === response, `UI ${response} rejected: ${JSON.stringify(result)}`);
          if(response==='swap')assert(result.actionDurationSeconds===.25,'Swap duration still depends on walking speed');
          let intermediateSamples = 0;
          const duration = result.actionDurationSeconds!;
          for (let i = 0; i < 10; i++) {
            r.movementResolver.tick(duration / 10, delta => a.projectSimulation(delta));
            assert(same(marker.position.asArray(), body.worldPosition!), `Idle Agent visual stale during ${response} at sample ${i}`);
            assert(same(playerMarker.position.asArray(), r.playerWorldPosition), `Player visual stale during ${response}`);
            if(response==='swap') {
              assert(body.pose.y===targetFrom.tileY,'Physical swap still follows a side lane');
              assert(Math.abs(marker.position.z-r.movementResolver.worldPositionFor!(body.pose.x,body.pose.y)[2])<=8*.12+1e-6,'Cosmetic sidestep too large');
              if(i<9)assert(r.playerPosition.tileX===from.tileX&&body.logicalPosition.tileX===targetFrom.tileX,'Swap committed before the animation ended');
            }
            if (body.pose.x % 1 !== 0 || body.pose.y % 1 !== 0) intermediateSamples++;
          }
          r.movementResolver.tick(.01, delta => a.projectSimulation(delta));
          assert(intermediateSamples > 0, 'No continuous animation observed');
          assert(r.playerPosition.tileX === targetFrom.tileX, 'Player anchor not committed');
          assert(body.logicalPosition.tileX === (response === 'swap' ? from.tileX : targetFrom.tileX + 1), 'Agent anchor not committed');
          assert(same(marker.position.asArray(), body.worldPosition!), 'Final visual pose stale');
          assert(!r.movementResolver.isBusy('$dungeon-player'), 'Group did not finish');
        }
        results.push({ response, result, player: { ...r.playerPosition }, agent: { ...body.logicalPosition }, marker: marker.position.asArray() });
        await settle();
      }
      body.onPlayerPush = 'swap';
      setDungeonRuntimePlayerPosition(r, { tileX: body.logicalPosition.tileX - 1, tileY: body.logicalPosition.tileY });
      const moving = r.movementResolver.requestMove({ actorId: body.id, direction: 'east', durationSeconds: 1 });
      assert(moving.accepted, 'Busy target fixture failed');
      document.querySelector<HTMLButtonElement>('[data-move="east"]')!.click();
      assert(document.body.textContent?.includes('目标正在执行动作'), 'Missing interaction rejection explanation');
      r.movementResolver.tick(.2, delta => a.projectSimulation(delta));
      assert(document.body.textContent?.includes('目标正在执行动作'), 'Bump completion erased failure explanation');
      await settle();
      return { ok: true, configurations, results, busyTargetExplanation: true };
    } finally { await settle(); host.dispose(); }
  } finally { DungeonRuntimeAssembly.prototype.prepare = prepare; }
}
run().then(result => { document.querySelector('#result')!.textContent = JSON.stringify(result); })
  .catch(error => { document.querySelector('#result')!.textContent = JSON.stringify({ ok: false, error: String(error), stack: error.stack }); });
