import type { DungeonAgentBinding, DungeonAgentMovement, DungeonAgentNavigationPlan, DungeonRuntimeAgent } from '../../../../core/dungeon-agent/dungeonAgent.types.ts';
import type { DungeonAgentSystemStorage } from '../../../../core/dungeon-agent/dungeonAgentSystem.ts';
import type { DungeonAgentsData, DungeonAgentState, DungeonAgentStateData } from './dungeonAgent.memory.ts';
import type { DungeonAgentControllerData, DungeonAgentControllerState, DungeonAgentSettingsData } from './dungeonAgentController.memory.ts';
import type { DungeonAgentNavigation, DungeonAgentNavigationData } from './dungeonAgentNavigation.memory.ts';

import type { DungeonRuntime } from '../../../../core/dungeon-runtime/dungeonRuntime.types.ts';

const EMPTY = Object.freeze([]);
const EMPTY_PARAMETERS = Object.freeze({});

/** All mutable authority is allocated here. Core receives facades over the domain records.
 * Bindings remain outside shared data; view fields are derived from the owned records. */
export const allocateDungeonAgentStorage = (loadId: number, presetKey: string, world?: DungeonRuntime) => {
  const descriptions: DungeonAgentsData = { loadId, presetKey, agents: new Map() };
  const state: DungeonAgentStateData & { activeAgentIds: Set<string> } = { loadId, presetKey, agents: new Map(), activeAgentIds: new Set() };
  const settings: DungeonAgentSettingsData = {
    loadId, presetKey, controllersEnabled: true, decisionIntervalSeconds: 0.1, maxPathSearchesPerDecision: 2,
  };
  const controllers: DungeonAgentControllerData & { decisionElapsed: number } = {
    loadId, presetKey, turnNumber: 0, decisionElapsed: 0, agents: new Map(),
  };
  const navigation: DungeonAgentNavigationData = { loadId, presetKey, agents: new Map() };
  const createAgent = (binding: DungeonAgentBinding): DungeonRuntimeAgent => {
    const entityId = binding.entity.id;
    const row: DungeonAgentState & { movement: DungeonAgentMovement | null } = {
      entityId, tileIndex: binding.initialTileIndex, facing: binding.gridAgent.initialFacing,
      enabled: true, priorityOverride: undefined, movement: null,
      get effectivePriority() { return row.priorityOverride ?? binding.gridAgent.priority; },
      get movementKind() { return row.movement?.kind ?? null; },
      get requestId() { return row.movement?.requestId; },
      get fromTileIndex() { return row.movement?.fromTileIndex ?? null; },
      get toTileIndex() { return row.movement?.toTileIndex ?? null; },
      get fromFacing() { return row.movement?.fromFacing ?? null; },
      get toFacing() { return row.movement?.toFacing ?? null; },
      get elapsedSeconds() { return row.movement?.elapsedSeconds ?? null; },
      get durationSeconds() { return row.movement?.durationSeconds ?? null; },
      get visualProgress() { return row.movement?.visualProgress; },
      get rotationProgress() { return row.movement?.rotationProgress; },
    };
    const controller: DungeonAgentControllerState = {
      entityId, actionClock: 0, controllerOverride: undefined, controllerState: undefined,
      get controllerId() { return controller.controllerOverride?.controllerId ?? binding.controller.controllerId; },
      get parameters() { return controller.controllerOverride?.parameters ?? binding.controller.parameters ?? EMPTY_PARAMETERS; },
      get source() { return controller.controllerOverride ? 'runtime-override' : 'map'; },
    };
    const path: DungeonAgentNavigation = {
      entityId, plan: undefined, reservationPlanSequence: undefined, reservationStartIndex: undefined,
      get hasPlan() { return !!path.plan; },
      get targetTileIndex() { return path.plan?.targetTileIndex ?? null; },
      get tileIndices() { return path.plan?.tileIndices ?? EMPTY; },
      get directions() { return path.plan?.directions ?? EMPTY; },
      get nextStepIndex() { return path.plan?.nextStepIndex ?? null; },
      get totalCost() { return path.plan?.totalCost ?? null; },
      get visitedCount() { return path.plan?.visitedCount ?? null; },
      get planSequence() { return path.plan?.planSequence ?? null; },
      get repairCount() { return path.plan?.repairCount; },
      get blockedReason() { return path.plan?.blocked?.reason ?? null; },
      get blockedFromTileIndex() { return path.plan?.blocked?.fromTileIndex ?? null; },
      get blockedToTileIndex() { return path.plan?.blocked?.toTileIndex; },
      get retryRemainingSeconds() { return path.plan?.blocked?.retryRemainingSeconds ?? null; },
      get consecutiveFailures() { return path.plan?.blocked?.consecutiveFailures ?? null; },
    };
    descriptions.agents.set(entityId, {
      entityId,
      get name() { return binding.entity.name ?? entityId; },
      get factionId() { return binding.faction?.factionId ?? 'neutral'; },
      get initialTileIndex() { return binding.initialTileIndex; },
      get blocksMovement() { return binding.gridAgent.blocksMovement; },
      get actionPeriod() { return binding.gridAgent.actionPeriod; },
      get initialPriority() { return binding.gridAgent.priority; },
      get movementProfileId() { return binding.gridAgent.movementProfileId; },
      get spatialFootprint() { return binding.gridAgent.spatialFootprint ?? 'center'; },
    });
    const body = world?.traversal.body(entityId);
    if (body) {
      Object.defineProperties(row, {
        tileIndex: { enumerable:true, get:()=>body.tileIndex,set:value=>{body.tileIndex=value;} },
        facing: { enumerable:true,get:()=>body.facing,set:value=>{body.facing=value;} },
        enabled: { enumerable:true,get:()=>body.enabled,set:value=>{body.enabled=value;} },
        poseX: { enumerable:true,get:()=>body.pose.x }, poseY:{enumerable:true,get:()=>body.pose.y},
        movement: { enumerable:true,get:()=>world!.movementResolver.storage.tracks!.get(entityId)??null,
          set:value=>{if(value)world!.movementResolver.storage.tracks!.set(entityId,value);else world!.movementResolver.storage.tracks!.delete(entityId);} },
      });
    }
    state.agents.set(entityId, row);
    controllers.agents.set(entityId, controller);
    navigation.agents.set(entityId, path);
    return {
      binding,
      get tileIndex() { return row.tileIndex; }, set tileIndex(value) { row.tileIndex = value; },
      get facing() { return row.facing; }, set facing(value) { row.facing = value; },
      get enabled() { return row.enabled; }, set enabled(value) { row.enabled = value; },
      get priorityOverride() { return row.priorityOverride; }, set priorityOverride(value) { row.priorityOverride = value; },
      get movement() { return row.movement; }, set movement(value) { row.movement = value; },
      get actionClock() { return controller.actionClock; }, set actionClock(value) { controller.actionClock = value; },
      get controllerOverride() { return controller.controllerOverride; }, set controllerOverride(value) { controller.controllerOverride = value; },
      get controllerState() { return controller.controllerState; }, set controllerState(value) { controller.controllerState = value; },
      get navigationPlan(): DungeonAgentNavigationPlan | undefined { return path.plan; }, set navigationPlan(value) { path.plan = value; },
      get reservationPlanSequence() { return path.reservationPlanSequence; }, set reservationPlanSequence(value) { path.reservationPlanSequence = value; },
      get reservationStartIndex() { return path.reservationStartIndex; }, set reservationStartIndex(value) { path.reservationStartIndex = value; },
    };
  };
  const storage: DungeonAgentSystemStorage = { createAgent, turnCounter: controllers, settings, clock: controllers, activeAgentIds: state.activeAgentIds };
  return { descriptions, state, settings, controllers, navigation, storage };
};
