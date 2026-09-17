import assert from 'node:assert/strict';
import test from 'node:test';
import { createEntityContainer } from '../entity/entity.utils.ts';
import type { IEntity } from '../entity/entity.types.ts';
import { createDungeonMapData } from '../map/dungeonMap.create.ts';
import { migrateDungeonMapToDocumentV2 } from '../map-document/dungeonMapDocument.migrate.ts';
import { createDungeonRuntimeMap } from '../dungeon-runtime/dungeonRuntimeMap.ts';
import {
  createDungeonAgentRuntimeState,
  scanDungeonDocumentAgents,
  startDungeonAgentMovement,
  startDungeonAgentTurn,
  updateDungeonAgentMovements,
} from './index.ts';

const agentEntity = (): IEntity => ({
  id: 'agent:guard',
  entityType: 'dungeon-agent',
  name: '守卫',
  enabled: true,
  components: [
    {
      id: 'agent:guard:grid', type: 'grid-agent', version: 1,
      initialFacing: 'east', blocksMovement: true, actionPeriod: 1, priority: 0,
      movementProfileId: 'ground',
    },
    {
      id: 'agent:guard:controller', type: 'agent-controller', version: 1,
      controllerId: 'stationary', parameters: {},
    },
    { id: 'agent:guard:faction', type: 'faction', version: 1, factionId: 'hostile' },
  ],
});

const createDocument = () => migrateDungeonMapToDocumentV2({
  presetKey: 'agent-test',
  name: 'Agent 测试',
  map: createDungeonMapData({
    id: 'map:agent-test',
    width: 2,
    height: 1,
    createTileData: ({ x }) => x === 0 ? createEntityContainer(agentEntity()) : undefined,
  }),
}).document;

test('扫描 dungeon-agent 并解析唯一初始格和朝向', () => {
  const bindings = scanDungeonDocumentAgents(createDocument());
  assert.equal(bindings.length, 1);
  assert.equal(bindings[0].initialTileIndex, 0);
  assert.equal(bindings[0].gridAgent.initialFacing, 'east');
  assert.equal(bindings[0].controller.controllerId, 'stationary');
  assert.equal(bindings[0].faction?.factionId, 'hostile');
});

test('Agent Runtime 建立占位并执行带朝向的格步移动', () => {
  const map = createDungeonRuntimeMap(createDocument());
  const state = createDungeonAgentRuntimeState(map);
  assert.deepEqual([...state.occupantsByTile[0]], [0]);
  const result = startDungeonAgentMovement(state, map, 'agent:guard', 'east', { durationSeconds: 0.3 });
  assert.equal(result.started, true);
  assert.equal(state.agents[0].tileIndex, 1);
  assert.equal(state.agents[0].facing, 'east');
  assert.deepEqual([...state.occupantsByTile[0]], []);
  assert.deepEqual([...state.occupantsByTile[1]], [0]);
  assert.deepEqual(updateDungeonAgentMovements(state, 0.2), []);
  assert.deepEqual(updateDungeonAgentMovements(state, 0.1), ['agent:guard']);
  assert.equal(state.agents[0].movement, null);
});

test('Agent 支持原地转向并拒绝地图边界移动', () => {
  const map = createDungeonRuntimeMap(createDocument());
  const state = createDungeonAgentRuntimeState(map);
  const turn = startDungeonAgentTurn(state, 'agent:guard', 'left', 0);
  assert.equal(turn.completed, true);
  assert.equal(state.agents[0].facing, 'north');
  const blocked = startDungeonAgentMovement(state, map, 'agent:guard', 'north');
  assert.equal(blocked.blockedReason, 'map-boundary');
});

test('扫描器拒绝缺少必需组件的 dungeon-agent', () => {
  const document = createDocument();
  document.components['agent-controller'] = [];
  assert.throws(() => scanDungeonDocumentAgents(document), /agent-controller/);
});
