import assert from 'node:assert/strict';
import test from 'node:test';
import { createDungeonMapData } from '../map/dungeonMap.create.ts';
import type { DungeonMapPreset } from '../map/dungeonMap.types.ts';
import { migrateDungeonMapToDocumentV2 } from './dungeonMapDocument.migrate.ts';
import {
  createDungeonMapDocumentMutationPlan,
  executeDungeonMapDocumentMutationPlan,
} from './dungeonMapDocument.mutationPlan.ts';
import { DungeonMapDocumentQuery } from './dungeonMapDocument.query.ts';
import { DungeonMapDocumentStore } from './dungeonMapDocument.store.ts';

const createStore = () => {
  const preset: DungeonMapPreset = {
    presetKey: 'native-batch-test',
    name: '原生批量测试',
    map: createDungeonMapData({ id: 'map:native-batch-test', width: 2, height: 1 }),
  };
  return new DungeonMapDocumentStore(migrateDungeonMapToDocumentV2(preset).document);
};

test('原生批量计划直接修改 ECS 表，并作为一个步骤撤销', () => {
  const store = createStore();
  const target = { kind: 'tile' as const, tileId: store.getDocument().grid.tileIds[0] };
  store.addEntityAt(target, {
    id: 'actor:batch',
    entityType: 'dungeon-actor',
    name: '修改前',
    components: [{ id: 'actor:batch:state', type: 'state', version: 1, removable: true }],
  });
  store.markSaved();
  const before = new DungeonMapDocumentQuery(store.getDocument()).getContainerAt(target);
  const after = structuredClone(before);
  after.entities[0].name = '修改后';
  delete after.entities[0].components[0].removable;
  after.entities[0].components.push({ id: 'actor:batch:extra', type: 'extra', version: 1 });

  const plan = createDungeonMapDocumentMutationPlan(store.getDocument(), '批量修改', [{ target, before, after }]);
  assert.deepEqual(plan.blockedReasons, []);
  assert.equal(executeDungeonMapDocumentMutationPlan(store, plan), true);
  const changed = new DungeonMapDocumentQuery(store.getDocument()).getContainerAt(target).entities[0];
  assert.equal(changed.name, '修改后');
  assert.equal('removable' in changed.components[0], false);
  assert.equal(changed.components[1].id, 'actor:batch:extra');
  assert.equal(store.undo(), true);
  assert.deepEqual(new DungeonMapDocumentQuery(store.getDocument()).getContainerAt(target), before);
  assert.equal(store.canUndo, true, '保存前的创建历史仍保留，但批量操作自身只占一个步骤');
});

test('多目标删除同一个多挂载 Entity 时不会重复删除组件', () => {
  const store = createStore();
  const [firstTileId, secondTileId] = store.getDocument().grid.tileIds;
  const first = { kind: 'tile' as const, tileId: firstTileId };
  const second = { kind: 'tile' as const, tileId: secondTileId };
  store.addEntityAt(first, {
    id: 'actor:shared',
    entityType: 'dungeon-actor',
    components: [{ id: 'actor:shared:state', type: 'state', version: 1 }],
  });
  store.attachEntity('actor:shared', second);
  const query = new DungeonMapDocumentQuery(store.getDocument());
  const plan = createDungeonMapDocumentMutationPlan(store.getDocument(), '批量移除', [
    { target: first, before: query.getContainerAt(first), after: { entities: [] } },
    { target: second, before: query.getContainerAt(second), after: { entities: [] } },
  ]);
  assert.deepEqual(plan.blockedReasons, []);
  executeDungeonMapDocumentMutationPlan(store, plan);
  assert.equal(store.getDocument().entities.length, 0);
  assert.equal(Object.values(store.getDocument().components).flat().length, 0);
});

test('同一多挂载 Entity 产生不同批量结果时阻止提交', () => {
  const store = createStore();
  const [firstTileId, secondTileId] = store.getDocument().grid.tileIds;
  const first = { kind: 'tile' as const, tileId: firstTileId };
  const second = { kind: 'tile' as const, tileId: secondTileId };
  store.addEntityAt(first, { id: 'actor:conflict', entityType: 'dungeon-actor', components: [] });
  store.attachEntity('actor:conflict', second);
  const query = new DungeonMapDocumentQuery(store.getDocument());
  const beforeFirst = query.getContainerAt(first);
  const beforeSecond = query.getContainerAt(second);
  const afterFirst = structuredClone(beforeFirst);
  const afterSecond = structuredClone(beforeSecond);
  afterFirst.entities[0].name = 'A';
  afterSecond.entities[0].name = 'B';
  const plan = createDungeonMapDocumentMutationPlan(store.getDocument(), '冲突修改', [
    { target: first, before: beforeFirst, after: afterFirst },
    { target: second, before: beforeSecond, after: afterSecond },
  ]);
  assert.match(plan.blockedReasons[0], /冲突结果/);
  assert.equal(plan.operations.length, 0);
});
