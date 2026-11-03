import { createLab } from '../labs/kit';
import { dungeonLabModuleCatalog } from '../labs/modules/dungeon';
import { DungeonRuntimeAssembly } from '../core/dungeon-runtime/dungeonRuntimeAssembly';
import { LabMemoryRegistry } from '../labs/kit/shared-memory/LabMemory';
import { LabCommunication } from '../labs/kit/labCommunication';
import { SystemRunner } from '../core/system-runtime/SystemRunner';
import { dungeonMapSwitchRequest } from '../labs/modules/dungeon/dungeon-map-loader/dungeonMapLoader.protocol';
import { DungeonPlayerStepEvents } from '../core/dungeon-player-movement/dungeonPlayerStepEvents';
import { scanDungeonDocumentAgents } from '../core/dungeon-agent/dungeonAgent.scan';
import type { DungeonRuntime } from '../core/dungeon-runtime/dungeonRuntime.types';
import type { DungeonAgentSystem } from '../core/dungeon-agent/dungeonAgentSystem';
import { snapshot as sceneSnapshot } from './dungeonLifecycleProbe';
import '../labs/kit/styles.css';

function check(value: unknown, message: string): asserts value { if (!value) throw new Error(message); }
const settle = () => new Promise(resolve => setTimeout(resolve, 0));
// Diagnostic access to collection cardinalities only; never serialize live object graphs.
const size = (owner: unknown, field: string) => ((owner as Record<string, { size?: number }>)[field]?.size ?? 0);

async function run() {
  let runtime: DungeonRuntime | undefined, assembly: DungeonRuntimeAssembly | undefined;
  let memory: LabMemoryRegistry | undefined, communication: LabCommunication | undefined, runner: SystemRunner | undefined;
  let steps: DungeonPlayerStepEvents | undefined;
  const oldSessions: Array<{ loadId: number; ref: WeakRef<DungeonRuntime>; seconds: number }> = [];
  const prepare = DungeonRuntimeAssembly.prototype.prepare;
  const memoryScope = LabMemoryRegistry.prototype.scope;
  const communicationScope = LabCommunication.prototype.scope;
  const register = SystemRunner.prototype.register;
  const subscribeStep = DungeonPlayerStepEvents.prototype.subscribe;
  DungeonRuntimeAssembly.prototype.prepare = function(next, loadId) {
    if (runtime) oldSessions.push({ loadId: this.inspect().activeLoadId!, ref: new WeakRef(runtime), seconds: runtime.movementResolver.storage.simulationSeconds! });
    runtime = next; assembly = this;
    return prepare.call(this, next, loadId);
  };
  LabMemoryRegistry.prototype.scope = function(...args) { memory = this; return memoryScope.apply(this, args); };
  LabCommunication.prototype.scope = function(...args) { communication = this; return communicationScope.apply(this, args); };
  SystemRunner.prototype.register = function(...args) { runner = this; return register.apply(this, args); };
  DungeonPlayerStepEvents.prototype.subscribe = function(...args) { steps = this; return subscribeStep.apply(this, args); };
  let host: Awaited<ReturnType<typeof createLab>> | undefined;
  try {
    host = await createLab({ root: document.querySelector<HTMLElement>('#root')!, title: 'Dungeon data lifecycle audit',
      description: '', badge: '', modules: ['dungeon-config', 'dungeon-transition', 'dungeon-agent', 'dungeon-visual-deformation'],
      catalog: dungeonLabModuleCatalog });
    host.context.engine.stopRenderLoop();
    check(memory && communication && runner && assembly && runtime && steps, 'Diagnostic hooks did not capture the host');
    const baselines = new Map<string, string>();
    const snapshots = [];
    const keys = ['dungeon_map', 'dungeon_map_2', 'dungeon_push_test'];
    for (let round = 0; round < 4; round++) for (const key of keys) {
      await host.context.communication.request(dungeonMapSwitchRequest, { presetKey: key });
      await settle();
      const r = runtime!, a = assembly!;
      const system = a.readPreparation<DungeonAgentSystem>(r, 'dungeon-agent');
      const loadId = a.inspect().activeLoadId!;
      const expectedIds = scanDungeonDocumentAgents(r.map.document).map(agent => agent.entity.id).sort();
      const actualIds = system.state.agents.map(agent => agent.binding.entity.id).sort();
      check(JSON.stringify(expectedIds) === JSON.stringify(actualIds), `${key}: Agent IDs differ from the document`);
      check(new Set(actualIds).size === actualIds.length, `${key}: duplicate runtime Agents`);
      const entries = (memory as unknown as { entries: Map<string, { value: any }> }).entries;
      const agentDomains: Record<string, number> = {};
      for (const [name, { value }] of entries) {
        if (value && typeof value === 'object' && typeof value.loadId === 'number') {
          check(value.loadId === loadId, `${name}: stale load ID ${value.loadId} instead of ${loadId}`);
        }
        if (name.startsWith('dungeon.agent') && value?.agents instanceof Map) {
          agentDomains[name] = value.agents.size;
          check(value.agents.size === expectedIds.length, `${name}: wrong Agent count`);
          check(JSON.stringify([...value.agents.keys()].sort()) === JSON.stringify(expectedIds), `${name}: stale Agent IDs`);
        }
      }
      check(Object.keys(agentDomains).length >= 4, 'Agent domain coverage incomplete');
      const world = r.traversal, engine = r.movementResolver;
      let occupancyEntries = 0;
      for (const [tile, ids] of world.occupantIdsByTile.entries()) for (const id of ids) {
        occupancyEntries++;
        check(world.body(id)?.tileIndex === tile, `${key}: stale occupancy ${id}`);
      }
      for (const body of world.spatial.bodies.values()) {
        check(world.actors.get(body.id) === body, `${key}: split actor/body identity`);
        if (body.tileIndex >= 0) check(world.occupantIdsByTile[body.tileIndex].has(body.id), `${key}: missing occupancy ${body.id}`);
        for (const id of body.colliderIds) check(world.spatial.colliders.get(id)?.bodyId === body.bodyId, `${key}: stale collider`);
      }
      check(engine.storage.activeRequests.size === 0 && engine.storage.tracks!.size === 0, `${key}: old movements restored`);
      check(engine.storage.groups!.size === 0, `${key}: old action groups restored`);
      check(world.pathReservationsByTile.every(row => row.size === 0), `${key}: old path reservations restored`);
      check(engine.movementReservationsByTile.every(row => row.size === 0), `${key}: old movement reservations restored`);
      const counts = {
        agents: actualIds.length, agentDomains, bodies: world.spatial.bodies.size, colliders: world.spatial.colliders.size,
        actors: world.actors.size, occupancyEntries, obstacleStates: r.obstacleStates.size,
        simulationParticipants: a.inspectSimulationCount(), tasks: runner.inspect().map(({ owner, id }) => owner + '/' + id),
        memoryEntries: memory.inspect().length,
        memoryConsumers: memory.inspect().reduce((sum, entry) => sum + entry.modules.length, 0),
        eventListeners: communication.inspectEvents().filter(entry => entry.listenerCount > 0)
          .map(entry => [entry.protocol, entry.listenerCount]),
        requestHandlers: communication.inspectBindings().requests.length,
        stepListeners: size(steps, 'listeners'), traversalListeners: size(world, 'changeListeners'),
        movementListeners: size(engine, 'changeListeners'), groupListeners: size(engine, 'groupListeners'),
      };
      const serialized = JSON.stringify(counts);
      if (!baselines.has(key)) baselines.set(key, serialized);
      if (baselines.get(key) !== serialized) {
        const before = JSON.parse(baselines.get(key)!);
        const differences = Object.fromEntries(Object.entries(counts).filter(([field, value]) => JSON.stringify(before[field]) !== JSON.stringify(value))
          .map(([field, value]) => [field, { before: before[field], after: value }]));
        throw new Error(`${key}: collection or listener counts changed on round ${round + 1}: ${JSON.stringify(differences)}`);
      }
      const saves = entries.get('dungeon.runtime-saves')!.value;
      for (const [saveKey, save] of Object.entries(saves) as Array<[string, { bodies?: { bodyId: string }[] }]>) {
        const ids = save.bodies?.map(body => body.bodyId) ?? [];
        check(new Set(ids).size === ids.length, `${saveKey}: duplicate bodies in save`);
      }
      check(Object.keys(saves).length <= keys.length, 'Saves accumulate by visit rather than map');
      snapshots.push({ round: round + 1, key, loadId, counts, saveMaps: Object.keys(saves),
        saveBodyCounts: Object.fromEntries(Object.entries(saves).map(([key, save]: [string, any]) => [key, save.bodies?.length ?? 0])),
        scene: sceneSnapshot() });
      // Exercise live controllers and movements; outgoing maps must not continue afterwards.
      for (let tick = 0; tick < 4; tick++) engine.tick(.2, delta => a.projectSimulation(delta));
      check(!engine.storage.timing?.stall, `${key}: simulation stalled`);
      for (const old of oldSessions) {
        const previous = old.ref.deref();
        if (previous) check(previous.movementResolver.storage.simulationSeconds === old.seconds, `Old session ${old.loadId} still simulates`);
      }
    }
    // Yield before GC so a WeakRef deref in this job cannot keep an old runtime alive.
    const gc = (globalThis as unknown as { gc?: () => void }).gc;
    if (gc) for (let pass = 0; pass < 4; pass++) { await settle(); gc(); }
    await settle();
    const retainedOldSessions = oldSessions.filter(old => old.ref.deref()).map(old => old.loadId);
    check(!gc || retainedOldSessions.length === 0, `Old runtimes survived GC: ${retainedOldSessions.join(', ')}`);
    const beforeDispose = { tasks: runner.inspect().length, memoryEntries: memory.inspect().length,
      events: communication.inspectEvents().length, simulationParticipants: assembly.inspectSimulationCount(),
      journalEntries: host.context.communicationJournal.getEntries().length, journalCapacity: host.context.communicationJournal.capacity };
    check(beforeDispose.journalEntries <= beforeDispose.journalCapacity, 'Communication journal exceeds its bound');
    host.dispose();
    const afterDispose = { tasks: runner.inspect().length, memoryEntries: memory.inspect().length,
      events: communication.inspectEvents().length, simulationParticipants: assembly.inspectSimulationCount(), stepListeners: size(steps, 'listeners') };
    check(Object.values(afterDispose).every(value => value === 0), 'Host dispose left active data/listeners');
    return { ok: true, visits: snapshots.length, snapshots, gcAvailable: !!gc, retainedOldSessions, beforeDispose, afterDispose };
  } finally {
    host?.dispose();
    DungeonRuntimeAssembly.prototype.prepare = prepare;
    LabMemoryRegistry.prototype.scope = memoryScope;
    LabCommunication.prototype.scope = communicationScope;
    SystemRunner.prototype.register = register;
    DungeonPlayerStepEvents.prototype.subscribe = subscribeStep;
  }
}

void run().then(result => { document.querySelector('#result')!.textContent = JSON.stringify(result); })
  .catch(error => { document.querySelector('#result')!.textContent = JSON.stringify({ ok: false, error: String(error), stack: error.stack }); });
