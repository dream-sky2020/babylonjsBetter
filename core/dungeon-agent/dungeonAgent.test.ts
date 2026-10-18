import assert from 'node:assert/strict';
import test from 'node:test';
import { createEntityContainer } from '../entity/entity.utils.ts';
import type { IEntity } from '../entity/entity.types.ts';
import { createDungeonMapData } from '../map/dungeonMap.create.ts';
import { migrateDungeonMapToDocumentV2 } from '../map-document/dungeonMapDocument.migrate.ts';
import { createDungeonRuntimeMap } from '../dungeon-runtime/dungeonRuntimeMap.ts';
import {
  createDungeonAgentRuntimeState,
  rebuildDungeonAgentPathReservations,
  scanDungeonDocumentAgents,
  startDungeonAgentMovement,
  startDungeonAgentTurn,
  updateDungeonAgentMovements,
} from './index.ts';
import { DUNGEON_PLAYER_TRAVERSAL_ACTOR_ID } from '../dungeon-traversal/index.ts';

const agentEntity = (): IEntity => ({
  id: 'agent:guard',
  entityType: 'dungeon-agent',
  name: '守卫',
  enabled: true,
  components: [
    {
      id: 'agent:guard:grid', type: 'grid-agent', version: 1,
      initialFacing: 'east', blocksMovement: true, actionPeriod: 1, priority: 7,
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
  assert.equal(bindings[0].gridAgent.priority, 7);
  assert.equal(bindings[0].controller.controllerId, 'stationary');
  assert.equal(bindings[0].faction?.factionId, 'hostile');
});

test('Agent Runtime 建立占位并执行带朝向的格步移动', () => {
  const map = createDungeonRuntimeMap(createDocument());
  const state = createDungeonAgentRuntimeState(map);
  assert.deepEqual([...state.traversal.occupantIdsByTile[0]], ['agent:guard']);
  assert.equal(state.traversal.actors.get('agent:guard')?.spatialFootprint, 'center');
  const result = startDungeonAgentMovement(state, map, 'agent:guard', 'east', { durationSeconds: 0.3 });
  assert.equal(result.started, true);
  assert.equal(state.agents[0].tileIndex, 0);
  assert.equal(state.agents[0].facing, 'east');
  assert.deepEqual([...state.traversal.occupantIdsByTile[0]], ['agent:guard']);
  assert.deepEqual([...state.traversal.occupantIdsByTile[1]], []);
  assert.equal(state.movementResolver.movementReservationsByTile[1].get('agent:guard'), state.agents[0].movement?.requestId);
  assert.deepEqual(updateDungeonAgentMovements(state, 0.2), []);
  assert.equal(state.agents[0].tileIndex, 1);
  assert.deepEqual([...state.traversal.occupantIdsByTile[0]], []);
  assert.deepEqual([...state.traversal.occupantIdsByTile[1]], ['agent:guard']);
  assert.equal(state.movementResolver.movementReservationsByTile[1].has('agent:guard'), false);
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

test('Agent 通过共享通行世界把玩家视为阻挡型占位', () => {
  const map = createDungeonRuntimeMap(createDocument());
  const state = createDungeonAgentRuntimeState(map);
  state.traversal.registerActor({
    id: DUNGEON_PLAYER_TRAVERSAL_ACTOR_ID, kind: 'player', tileIndex: 1,
    enabled: true, blocksMovement: true, movementProfileId: 'ground',
  });
  const result = startDungeonAgentMovement(state, map, 'agent:guard', 'east');
  assert.equal(result.started, false);
  assert.equal(result.blockedReason, 'occupied');
});

test('Agent Runtime 根据剩余路径建立并推进格子预约', () => {
  const map = createDungeonRuntimeMap(createDocument());
  const state = createDungeonAgentRuntimeState(map);
  state.agents[0].navigationPlan = {
    targetTileIndex: 1,
    tileIndices: [0, 1],
    directions: ['east'],
    nextStepIndex: 0,
    totalCost: 1,
    visitedCount: 2,
    planSequence: 1,
  };
  rebuildDungeonAgentPathReservations(state);
  assert.equal(state.traversal.reservationsByTile[1].get('agent:guard'), 1);
  state.agents[0].navigationPlan.nextStepIndex = 1;
  rebuildDungeonAgentPathReservations(state);
  assert.equal(state.traversal.reservationsByTile[1].has('agent:guard'), false);
});

test('higher-priority swap clears an Agent move and route, then syncs its final anchor',()=>{
  const document=migrateDungeonMapToDocumentV2({presetKey:'agent-swap',name:'Agent 换位',map:createDungeonMapData({
    id:'agent-swap',width:3,height:1,
    createTileData:({x})=>x===1?createEntityContainer(agentEntity()):undefined,
  })}).document;
  const map=createDungeonRuntimeMap(document),state=createDungeonAgentRuntimeState(map),engine=state.movementResolver;
  state.traversal.registerActor({id:'high',kind:'dynamic',tileIndex:2,enabled:true,blocksMovement:true,movementProfileId:'ground'});
  const agent=state.agents[0];
  agent.navigationPlan={targetTileIndex:0,tileIndices:[1,0],directions:['west'],nextStepIndex:0,
    totalCost:1,visitedCount:2,planSequence:1};
  rebuildDungeonAgentPathReservations(state);
  assert.equal(startDungeonAgentMovement(state,map,'agent:guard','west',{durationSeconds:1}).started,true);
  engine.tick(.2);
  const result=engine.requestSwap('high','agent:guard',0,1,true,{basePriority:10});
  assert.equal(result.accepted,true);
  assert.equal(agent.movement,null);
  assert.equal(agent.navigationPlan,undefined);
  assert.equal(state.traversal.reservationsByTile[0].has('agent:guard'),false);
  engine.tick(result.durationSeconds!);
  assert.equal(agent.tileIndex,2);
  assert.equal(state.traversal.body('agent:guard')!.tileIndex,2);
});

test('扫描器拒绝缺少必需组件的 dungeon-agent', () => {
  const document = createDocument();
  document.components['agent-controller'] = [];
  assert.throws(() => scanDungeonDocumentAgents(document), /agent-controller/);
});
