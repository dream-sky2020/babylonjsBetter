import type { DungeonMapDirection } from '../map/index.ts';
import { DUNGEON_MAP_DIRECTION_ORDER } from '../map-document/index.ts';
import type { DungeonRuntimeMap } from '../dungeon-runtime/dungeonRuntimeMap.ts';
import {
  startDungeonAgentMovement,
  type DungeonAgentMovementOptions,
} from './dungeonAgent.runtime.ts';
import type {
  DungeonAgentMovementResult,
  DungeonAgentRuntimeState,
  DungeonRuntimeAgent,
} from './dungeonAgent.types.ts';

export const RANDOM_AFTER_PLAYER_STEP_CONTROLLER_ID = 'random-after-player-step';
export const CONTINUOUS_RANDOM_WALK_CONTROLLER_ID = 'continuous-random-walk';

export type DungeonAgentControllerTrigger = 'player-step' | 'continuous';

export type DungeonAgentControllerAction = Readonly<{
  entityId: string;
  controllerId: string;
  trigger: DungeonAgentControllerTrigger;
  outcome: 'move-started' | 'idle' | 'blocked';
  direction?: DungeonMapDirection;
  movementResult?: DungeonAgentMovementResult;
}>;

export type DungeonAgentControllerExecutionOptions = Readonly<{
  isStepBlocked?: DungeonAgentMovementOptions['isStepBlocked'];
}>;

type RandomControllerState = {
  controllerId: string;
  randomState: number;
  idleRemainingSeconds: number | null;
  lastAction?: DungeonAgentControllerAction;
};

type DungeonAgentControllerContext = Readonly<{
  state: DungeonAgentRuntimeState;
  map: DungeonRuntimeMap;
  agent: DungeonRuntimeAgent;
  trigger: DungeonAgentControllerTrigger;
  random(): number;
  tryRandomMove(durationSeconds: number): DungeonAgentControllerAction;
  idle(): DungeonAgentControllerAction;
}>;

export type DungeonAgentController = Readonly<{
  id: string;
  onPlayerStep?(context: DungeonAgentControllerContext): DungeonAgentControllerAction | null;
  update?(context: DungeonAgentControllerContext, deltaSeconds: number): DungeonAgentControllerAction | null;
}>;

export type DungeonAgentControllerRegistry = ReadonlyMap<string, DungeonAgentController>;

const numberParameter = (
  agent: DungeonRuntimeAgent,
  key: string,
  fallback: number,
  minimum = 0,
): number => {
  const value = Number(agent.binding.controller.parameters?.[key]);
  return Number.isFinite(value) && value >= minimum ? value : fallback;
};

const hashSeed = (value: string): number => {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0 || 0x9e3779b9;
};

const controllerState = (agent: DungeonRuntimeAgent): RandomControllerState => {
  const controllerId = agent.binding.controller.controllerId;
  const current = agent.controllerState as Partial<RandomControllerState> | undefined;
  if (current?.controllerId === controllerId && typeof current.randomState === 'number') {
    return current as RandomControllerState;
  }
  const configuredSeed = Number(agent.binding.controller.parameters?.seed);
  const randomState = Number.isInteger(configuredSeed)
    ? (configuredSeed >>> 0) || 0x9e3779b9
    : hashSeed(`${agent.binding.entity.id}:${controllerId}`);
  const next: RandomControllerState = {
    controllerId,
    randomState,
    idleRemainingSeconds: null,
  };
  agent.controllerState = next;
  return next;
};

const nextRandom = (state: RandomControllerState): number => {
  let value = state.randomState >>> 0;
  value ^= value << 13;
  value ^= value >>> 17;
  value ^= value << 5;
  state.randomState = value >>> 0 || 0x9e3779b9;
  return state.randomState / 0x1_0000_0000;
};

const shuffledDirections = (random: () => number): DungeonMapDirection[] => {
  const directions = [...DUNGEON_MAP_DIRECTION_ORDER];
  for (let index = directions.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [directions[index], directions[swapIndex]] = [directions[swapIndex], directions[index]];
  }
  return directions;
};

const shouldIdle = (agent: DungeonRuntimeAgent, random: () => number): boolean => {
  const idleWeight = numberParameter(agent, 'idleWeight', 0);
  const moveWeight = numberParameter(agent, 'moveWeight', 1);
  const total = idleWeight + moveWeight;
  return total <= 0 || random() * total < idleWeight;
};

const createContext = (
  state: DungeonAgentRuntimeState,
  map: DungeonRuntimeMap,
  agent: DungeonRuntimeAgent,
  trigger: DungeonAgentControllerTrigger,
  options: DungeonAgentControllerExecutionOptions,
): DungeonAgentControllerContext => {
  const runtimeState = controllerState(agent);
  const base = { entityId: agent.binding.entity.id, controllerId: agent.binding.controller.controllerId, trigger };
  const random = () => nextRandom(runtimeState);
  const remember = (action: DungeonAgentControllerAction): DungeonAgentControllerAction => {
    runtimeState.lastAction = action;
    return action;
  };
  return {
    state,
    map,
    agent,
    trigger,
    random,
    idle: () => remember({ ...base, outcome: 'idle' }),
    tryRandomMove: (durationSeconds) => {
      let lastResult: DungeonAgentMovementResult | undefined;
      let lastDirection: DungeonMapDirection | undefined;
      for (const direction of shuffledDirections(random)) {
        const result = startDungeonAgentMovement(state, map, agent.binding.entity.id, direction, {
          durationSeconds,
          isStepBlocked: options.isStepBlocked,
        });
        lastResult = result;
        lastDirection = direction;
        if (result.started) {
          return remember({ ...base, outcome: 'move-started', direction, movementResult: result });
        }
      }
      return remember({
        ...base,
        outcome: 'blocked',
        direction: lastDirection,
        movementResult: lastResult,
      });
    },
  };
};

const randomAfterPlayerStepController: DungeonAgentController = {
  id: RANDOM_AFTER_PLAYER_STEP_CONTROLLER_ID,
  onPlayerStep(context) {
    if (context.agent.movement) return null;
    if (shouldIdle(context.agent, context.random)) return context.idle();
    return context.tryRandomMove(numberParameter(context.agent, 'moveDurationSeconds', 0.3));
  },
};

const continuousRandomWalkController: DungeonAgentController = {
  id: CONTINUOUS_RANDOM_WALK_CONTROLLER_ID,
  update(context, deltaSeconds) {
    if (context.agent.movement) return null;
    const state = controllerState(context.agent);
    if (state.idleRemainingSeconds === null) {
      const minimum = numberParameter(context.agent, 'minIdleSeconds', 0.2);
      const maximum = Math.max(minimum, numberParameter(context.agent, 'maxIdleSeconds', 0.8));
      state.idleRemainingSeconds = minimum + (maximum - minimum) * context.random();
    }
    state.idleRemainingSeconds -= deltaSeconds;
    if (state.idleRemainingSeconds > 0) return null;
    state.idleRemainingSeconds = null;
    if (shouldIdle(context.agent, context.random)) return context.idle();
    return context.tryRandomMove(numberParameter(context.agent, 'moveDurationSeconds', 0.3));
  },
};

export const createDefaultDungeonAgentControllerRegistry = (): DungeonAgentControllerRegistry => new Map([
  [randomAfterPlayerStepController.id, randomAfterPlayerStepController],
  // 兼容已经写入地图的早期随机漫游 ID；新地图应使用语义更明确的新 ID。
  ['random-walk', randomAfterPlayerStepController],
  [continuousRandomWalkController.id, continuousRandomWalkController],
]);

const agentsByPriority = (state: DungeonAgentRuntimeState): DungeonRuntimeAgent[] => [...state.agents]
  .sort((left, right) => (
    right.binding.gridAgent.priority - left.binding.gridAgent.priority
    || left.binding.entity.id.localeCompare(right.binding.entity.id)
  ));

export const runDungeonAgentControllersAfterPlayerStep = (
  state: DungeonAgentRuntimeState,
  map: DungeonRuntimeMap,
  registry: DungeonAgentControllerRegistry,
  options: DungeonAgentControllerExecutionOptions = {},
): readonly DungeonAgentControllerAction[] => {
  state.turnNumber += 1;
  const actions: DungeonAgentControllerAction[] = [];
  agentsByPriority(state).forEach((agent) => {
    const controller = registry.get(agent.binding.controller.controllerId);
    if (!agent.enabled || !controller?.onPlayerStep) return;
    agent.actionClock += 1;
    if (agent.actionClock < agent.binding.gridAgent.actionPeriod) return;
    agent.actionClock = 0;
    const action = controller.onPlayerStep(createContext(state, map, agent, 'player-step', options));
    if (action) actions.push(action);
  });
  return actions;
};

export const updateDungeonAgentControllers = (
  state: DungeonAgentRuntimeState,
  map: DungeonRuntimeMap,
  registry: DungeonAgentControllerRegistry,
  deltaSeconds: number,
  options: DungeonAgentControllerExecutionOptions = {},
): readonly DungeonAgentControllerAction[] => {
  if (!Number.isFinite(deltaSeconds) || deltaSeconds < 0) {
    throw new RangeError('Agent Controller 帧时间必须是非负有限数。');
  }
  const actions: DungeonAgentControllerAction[] = [];
  agentsByPriority(state).forEach((agent) => {
    const controller = registry.get(agent.binding.controller.controllerId);
    if (!agent.enabled || !controller?.update) return;
    const action = controller.update(createContext(state, map, agent, 'continuous', options), deltaSeconds);
    if (action) actions.push(action);
  });
  return actions;
};
