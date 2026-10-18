import { createLab } from '../labs/kit';
import { dungeonLabModuleCatalog } from '../labs/modules/dungeon';
import { DungeonRuntimeAssembly } from '../core/dungeon-runtime/dungeonRuntimeAssembly';
import { setDungeonRuntimePlayerPosition } from '../core/dungeon-runtime/dungeonRuntime';
import { DungeonPlayerSystem } from '../core/dungeon-player-movement/dungeonPlayerSystem';
import { startDungeonAgentMovement } from '../core/dungeon-agent/dungeonAgent.runtime';
import type { DungeonAgentSystem } from '../core/dungeon-agent/dungeonAgentSystem';
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
      const walkingSpeedInput = [...document.querySelectorAll<HTMLInputElement>('input')].find(input =>
        input.parentElement?.textContent?.includes('移动速度（世界单位/秒）'));
      assert(walkingSpeedInput, 'Walking speed control missing');
      const ignoreSidestep = [...document.querySelectorAll<HTMLInputElement>('input')].find(input =>
        input.parentElement?.textContent?.includes('换位计时忽略轻微错身距离'));
      assert(ignoreSidestep, 'Swap sidestep timing switch missing');
      const body = r.traversal.body('agent:plaza:friendly-guard')!;
      const marker = host.context.scene.transformNodes.find(node => node.name.startsWith('dungeon_agent_debug_') && node.name.endsWith('agent_plaza_friendly-guard'))!;
      const playerMarker = host.context.scene.getTransformNodeByName('composable_player_pose')!;
      assert(marker && playerMarker, 'Real visual nodes missing');
      const system = a.readPreparation<DungeonPlayerSystem>(r, 'player-movement');
      const results = [];
      for (const response of ['swap', 'push', 'block'] as const) {
        const walkingSpeedLimit=response==='swap'?10:60;
        walkingSpeedInput.value=String(walkingSpeedLimit);walkingSpeedInput.dispatchEvent(new Event('input'));
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
          if(response==='swap')assert(result.actionDurationSeconds!>.25,'Slow initiator did not extend swap duration');
          let intermediateSamples = 0;
          const duration = result.actionDurationSeconds!;
          const samples=60,deltaSeconds=duration/samples;
          let peakInteractionSpeed=0,minimumInteractionSpeed=Infinity;
          for (let i = 0; i < samples; i++) {
            const beforePlayer=[...r.playerWorldPosition],beforeObject=[...(body.worldPosition??r.movementResolver.worldPositionFor!(body.pose.x,body.pose.y))];
            r.movementResolver.tick(deltaSeconds, delta => a.projectSimulation(delta));
            assert(same(marker.position.asArray(), body.worldPosition!), `Idle Agent visual stale during ${response} at sample ${i}`);
            assert(same(playerMarker.position.asArray(), r.playerWorldPosition), `Player visual stale during ${response}`);
            if(response==='swap') {
              assert(body.pose.y===targetFrom.tileY,'Physical swap still follows a side lane');
              assert(Math.abs(marker.position.z-r.movementResolver.worldPositionFor!(body.pose.x,body.pose.y)[2])<=8*.12+1e-6,'Cosmetic sidestep too large');
              if(i<samples-1)assert(r.playerPosition.tileX===from.tileX&&body.logicalPosition.tileX===targetFrom.tileX,'Swap committed before the animation ended');
            } else {
              const actorPose=r.traversal.body('$dungeon-player')!.pose;
              assert(actorPose.x<=targetFrom.tileX+1e-8,'Push player overshot then returned');
            }
            for(const [position,before] of [[r.playerWorldPosition,beforePlayer],[body.worldPosition!,beforeObject]]) {
              const speed=Math.hypot(...position.map((value,axis)=>value-before[axis]))/deltaSeconds;
              peakInteractionSpeed=Math.max(peakInteractionSpeed,speed);
              minimumInteractionSpeed=Math.min(minimumInteractionSpeed,speed);
              assert(speed<=walkingSpeedLimit+1e-3,`${response} exceeds initiator walking speed: ${speed}`);
            }
            if (body.pose.x % 1 !== 0 || body.pose.y % 1 !== 0) intermediateSamples++;
          }
          r.movementResolver.tick(.01, delta => a.projectSimulation(delta));
          assert(intermediateSamples > 0, 'No continuous animation observed');
          assert(r.playerPosition.tileX === targetFrom.tileX, 'Player anchor not committed');
          assert(body.logicalPosition.tileX === (response === 'swap' ? from.tileX : targetFrom.tileX + 1), 'Agent anchor not committed');
          assert(same(marker.position.asArray(), body.worldPosition!), 'Final visual pose stale');
          assert(!r.movementResolver.isBusy('$dungeon-player'), 'Group did not finish');
          if(response==='swap')assert(minimumInteractionSpeed>=walkingSpeedLimit*.98,
            `Swap is slower than initiator walking speed: ${minimumInteractionSpeed}`);
          Object.assign(result,{verifiedPeakSpeed:peakInteractionSpeed,verifiedMinimumSpeed:minimumInteractionSpeed,walkingSpeedLimit});
        }
        results.push({ response, result, player: { ...r.playerPosition }, agent: { ...body.logicalPosition }, marker: marker.position.asArray() });
        await settle();
      }
      body.onPlayerPush = 'swap';
      walkingSpeedInput.value='10';walkingSpeedInput.dispatchEvent(new Event('input'));
      ignoreSidestep.checked=true;ignoreSidestep.dispatchEvent(new Event('change'));
      const ignoredFrom={tileX:body.logicalPosition.tileX-1,tileY:body.logicalPosition.tileY};
      setDungeonRuntimePlayerPosition(r,ignoredFrom);
      r.playerWorldPosition=r.movementResolver.worldPositionFor!(ignoredFrom.tileX,ignoredFrom.tileY);
      let ignoredResult:DungeonPlayerMovementResult|undefined;
      const originalMove=system.move;
      system.move=function(...args){const outcome=originalMove.apply(this,args);ignoredResult=outcome;return outcome;};
      try{document.querySelector<HTMLButtonElement>('[data-move="east"]')!.click();}
      finally{system.move=originalMove;}
      assert(ignoredResult?.actionKind==='swap','UI switch did not permit swap');
      const stepWorld=r.movementResolver.worldPositionFor!(ignoredFrom.tileX+1,ignoredFrom.tileY);
      const fromWorld=r.movementResolver.worldPositionFor!(ignoredFrom.tileX,ignoredFrom.tileY);
      const expectedDuration=Math.hypot(...stepWorld.map((value,index)=>value-fromWorld[index]))/10;
      assert(Math.abs(ignoredResult.actionDurationSeconds!-expectedDuration)<1e-8,
        'Ignore-sidestep switch did not use center distance');
      r.movementResolver.tick(ignoredResult.actionDurationSeconds!,delta=>a.projectSimulation(delta));
      ignoreSidestep.checked=false;ignoreSidestep.dispatchEvent(new Event('change'));
      setDungeonRuntimePlayerPosition(r, { tileX: body.logicalPosition.tileX - 1, tileY: body.logicalPosition.tileY });
      const agentSystem=a.readPreparation<DungeonAgentSystem>(r,'dungeon-agent');
      assert(agentSystem,'Agent system unavailable for shared-track takeover');
      const moving = startDungeonAgentMovement(agentSystem.state,r.map,body.id,'east',{durationSeconds:1});
      assert(moving.started,'Moving Agent fixture failed');
      const oldRequestId=agentSystem.state.agents.find(agent=>agent.binding.entity.id===body.id)?.movement?.requestId;
      assert(oldRequestId&&r.movementResolver.storage.tracks!.has(body.id),'Shared Agent movement track missing');
      r.movementResolver.tick(.2, delta => a.projectSimulation(delta));
      const takeoverPose={...body.pose};
      const takeoverFrom={...r.playerPosition};
      let takeoverResult:DungeonPlayerMovementResult|undefined;
      const originalTakeoverMove=system.move;
      system.move=function(...args){const outcome=originalTakeoverMove.apply(this,args);takeoverResult=outcome;return outcome;};
      try{document.querySelector<HTMLButtonElement>('[data-move="east"]')!.click();}
      finally{system.move=originalTakeoverMove;}
      assert(takeoverResult?.actionKind==='swap'&&takeoverResult.started,'Moving Agent was bumped instead of swapped');
      assert(!r.playerMovement&&r.movementResolver.getActiveRequest(body.id)===undefined,'Old Agent move was not superseded');
      assert(!r.movementResolver.storage.tracks!.has(body.id),'Old Agent presentation track survived takeover');
      assert(same([body.pose.x,body.pose.y],[takeoverPose.x,takeoverPose.y]),'Agent pose snapped at takeover');
      r.movementResolver.tick(takeoverResult.actionDurationSeconds!,delta=>a.projectSimulation(delta));
      assert(body.logicalPosition.tileX===takeoverFrom.tileX&&body.logicalPosition.tileY===takeoverFrom.tileY,
        'Moving Agent swap did not reach player anchor');
      assert(same(marker.position.asArray(),body.worldPosition!),'Moving Agent marker stale after takeover');
      await settle();
      await host.context.communication.request(dungeonMapSwitchRequest,{presetKey:'dungeon_push_test'});
      const pushRuntime=runtime!;
      const pushBodies=[...pushRuntime.traversal.spatial.bodies.values()].filter(item=>item.id!=='$dungeon-player');
      assert(pushBodies.length===24&&pushBodies.every(item=>item.mobility==='movable'&&item.pushable&&item.onPlayerPush==='push'),'Push preset contains non-pushable objects');
      assert(pushRuntime.playerPosition.tileX===8&&pushRuntime.playerPosition.tileY===8,'Push preset spawn incorrect');
      assert(host.context.scene.getTransformNodeByName('scene_environment_minimal-city'),'Push preset did not load minimal-city');
      const northObject=pushRuntime.traversal.body('push-test:01')!;
      const pushMarker=host.context.scene.transformNodes.find(node=>node.name.startsWith('dungeon_agent_debug_')&&node.name.endsWith('push-test_01'));
      assert(pushMarker,'Push object visual missing');
      document.querySelector<HTMLButtonElement>('[data-move="north"]')!.click();
      assert([...pushRuntime.movementResolver.storage.groups!.values()].some(group=>group.kind==='push'&&group.status==='running'),'Push preset UI collision did not start pushing');
      pushRuntime.movementResolver.tick(1,delta=>a.projectSimulation(delta));
      assert(northObject.logicalPosition.tileY===6&&Number(pushRuntime.playerPosition.tileY)===7,'Push preset did not commit pushed positions');
      assert(same(pushMarker.position.asArray(),northObject.worldPosition!),'Push preset object visual did not follow');
      await settle();
      return { ok: true, configurations, results, ignoredSidestepDuration:ignoredResult.actionDurationSeconds,
        movingTargetSwap: true,
        pushPreset:{presetKey:'dungeon_push_test',objects:pushBodies.length,scene:'minimal-city',uiPush:true,visualSync:true} };
    } finally { await settle(); host.dispose(); }
  } finally { DungeonRuntimeAssembly.prototype.prepare = prepare; }
}
run().then(result => { document.querySelector('#result')!.textContent = JSON.stringify(result); })
  .catch(error => { document.querySelector('#result')!.textContent = JSON.stringify({ ok: false, error: String(error), stack: error.stack }); });
