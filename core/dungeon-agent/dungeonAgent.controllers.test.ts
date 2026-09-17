import assert from 'node:assert/strict';
import test from 'node:test';
import { createEntityContainer } from '../entity/entity.utils.ts';
import type { IEntity } from '../entity/entity.types.ts';
import { createDungeonMapData } from '../map/dungeonMap.create.ts';
import { migrateDungeonMapToDocumentV2 } from '../map-document/dungeonMapDocument.migrate.ts';
import { createDungeonRuntimeMap } from '../dungeon-runtime/dungeonRuntimeMap.ts';
import {
  CONTINUOUS_RANDOM_WALK_CONTROLLER_ID,
  createDefaultDungeonAgentControllerRegistry,
  createDungeonAgentRuntimeState,
  RANDOM_AFTER_PLAYER_STEP_CONTROLLER_ID,
  runDungeonAgentControllersAfterPlayerStep,
  updateDungeonAgentControllers,
} from './index.ts';

const agentEntity = (controllerId: string, actionPeriod = 1): IEntity => ({
  id: 'agent:test',
  entityType: 'dungeon-agent',
  enabled: true,
  components: [
    {
      id: 'agent:test:grid', type: 'grid-agent', version: 1,
      initialFacing: 'east', blocksMovement: true, actionPeriod, priority: 0,
      movementProfileId: 'ground',
    },
    {
      id: 'agent:test:controller', type: 'agent-controller', version: 1,
      controllerId,
      parameters: {
        seed: 7,
        idleWeight: 0,
        moveWeight: 1,
        moveDurationSeconds: 0,
        minIdleSeconds: 0,
        maxIdleSeconds: 0,
      },
    },
  ],
});

const createRuntime = (controllerId: string, actionPeriod = 1) => {
  const document = migrateDungeonMapToDocumentV2({
    presetKey: 'agent-controller-test',
    name: 'Agent Controller 测试',
    map: createDungeonMapData({
      id: 'map:agent-controller-test',
      width: 2,
      height: 1,
      createTileData: ({ x }) => x === 0
        ? createEntityContainer(agentEntity(controllerId, actionPeriod))
        : undefined,
    }),
  }).document;
  const map = createDungeonRuntimeMap(document);
  return { map, state: createDungeonAgentRuntimeState(map) };
};

test('玩家格步随机 Controller 遵守 actionPeriod，并只在到期时行动', () => {
  const { map, state } = createRuntime(RANDOM_AFTER_PLAYER_STEP_CONTROLLER_ID, 2);
  const registry = createDefaultDungeonAgentControllerRegistry();

  assert.deepEqual(runDungeonAgentControllersAfterPlayerStep(state, map, registry), []);
  assert.equal(state.turnNumber, 1);
  assert.equal(state.agents[0].tileIndex, 0);

  const actions = runDungeonAgentControllersAfterPlayerStep(state, map, registry);
  assert.equal(state.turnNumber, 2);
  assert.equal(actions.length, 1);
  assert.equal(actions[0].outcome, 'move-started');
  assert.equal(state.agents[0].tileIndex, 1);
});

test('连续随机 Controller 使用自己的等待时钟，不依赖玩家格步', () => {
  const { map, state } = createRuntime(CONTINUOUS_RANDOM_WALK_CONTROLLER_ID);
  const actions = updateDungeonAgentControllers(
    state,
    map,
    createDefaultDungeonAgentControllerRegistry(),
    0,
  );

  assert.equal(state.turnNumber, 0);
  assert.equal(actions.length, 1);
  assert.equal(actions[0].trigger, 'continuous');
  assert.equal(actions[0].outcome, 'move-started');
  assert.equal(state.agents[0].tileIndex, 1);
});

test('相同 Agent 与 seed 会产生可复现的随机行动', () => {
  const first = createRuntime(RANDOM_AFTER_PLAYER_STEP_CONTROLLER_ID);
  const second = createRuntime(RANDOM_AFTER_PLAYER_STEP_CONTROLLER_ID);
  const registry = createDefaultDungeonAgentControllerRegistry();

  const firstAction = runDungeonAgentControllersAfterPlayerStep(first.state, first.map, registry)[0];
  const secondAction = runDungeonAgentControllersAfterPlayerStep(second.state, second.map, registry)[0];
  assert.deepEqual(firstAction, secondAction);
});
