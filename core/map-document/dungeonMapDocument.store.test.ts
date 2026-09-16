import assert from 'node:assert/strict';
import test from 'node:test';
import { createDungeonMapData } from '../map/dungeonMap.create.ts';
import type { DungeonMapPreset } from '../map/dungeonMap.types.ts';
import { migrateDungeonMapToDocumentV2 } from './dungeonMapDocument.migrate.ts';
import { DungeonMapDocumentStore } from './dungeonMapDocument.store.ts';

const createStore = (): DungeonMapDocumentStore => {
  const preset: DungeonMapPreset = {
    presetKey: 'store-test',
    name: 'Store 测试地图',
    map: createDungeonMapData({ id: 'map:store-test', width: 2, height: 1 }),
  };
  return new DungeonMapDocumentStore(migrateDungeonMapToDocumentV2(preset).document);
};

test('Entity、Component 和空间挂载通过命令修改并可撤销重做', () => {
  const store = createStore();
  const firstTileId = store.getDocument().grid.tileIds[0];

  store.addEntity({ id: 'actor:test', entityType: 'dungeon-actor', name: '测试 Actor' });
  store.addComponent({
    id: 'actor:test:behavior',
    entityId: 'actor:test',
    type: 'dungeon-actor-behavior',
    version: 1,
    behaviorType: 'stationary',
  });
  store.attachEntity('actor:test', { kind: 'tile', tileId: firstTileId });

  assert.equal(store.dirty, true);
  assert.equal(store.getDocument().entities.length, 1);
  assert.equal(store.getDocument().components['dungeon-actor-behavior'].length, 1);
  assert.equal(store.getDocument().components['spatial-attachment'].length, 1);
  assert.equal(store.undo(), true);
  assert.equal(store.getDocument().components['spatial-attachment'], undefined);
  assert.equal(store.redo(), true);
  assert.equal(store.getDocument().components['spatial-attachment'].length, 1);
});

test('事务中的多次修改只产生一个撤销步骤', () => {
  const store = createStore();
  store.beginTransaction('创建两个 Actor');
  store.addEntity({ id: 'actor:a', entityType: 'dungeon-actor' });
  store.addEntity({ id: 'actor:b', entityType: 'dungeon-actor' });
  assert.equal(store.commitTransaction(), true);
  assert.equal(store.getDocument().entities.length, 2);
  assert.equal(store.undo(), true);
  assert.equal(store.getDocument().entities.length, 0);
  assert.equal(store.canUndo, false);
});

test('回滚事务恢复原文档且不产生历史', () => {
  const store = createStore();
  const before = store.getDocument();
  store.beginTransaction('取消创建');
  store.addEntity({ id: 'actor:cancelled', entityType: 'dungeon-actor' });
  assert.equal(store.rollbackTransaction(), true);
  assert.equal(store.getDocument(), before);
  assert.equal(store.canUndo, false);
  assert.equal(store.dirty, false);
});

test('删除 Entity 会级联删除全部组件并可撤销', () => {
  const store = createStore();
  store.beginTransaction('准备 Actor');
  store.addEntity({ id: 'actor:remove', entityType: 'dungeon-actor' });
  store.addComponent({
    id: 'actor:remove:state',
    entityId: 'actor:remove',
    type: 'state',
    version: 1,
    current: 'idle',
  });
  store.attachEntity('actor:remove', { kind: 'tile', tileId: store.getDocument().grid.tileIds[0] });
  store.commitTransaction();
  store.markSaved();

  store.removeEntity('actor:remove');
  assert.equal(store.getDocument().entities.length, 0);
  assert.equal(Object.values(store.getDocument().components).flat().length, 0);
  assert.equal(store.undo(), true);
  assert.equal(store.getDocument().entities.length, 1);
  assert.equal(Object.values(store.getDocument().components).flat().length, 2);
  assert.equal(store.dirty, false);
});

test('重复 ID 和不存在的空间目标不会污染文档或历史', () => {
  const store = createStore();
  store.addEntity({ id: 'actor:unique', entityType: 'dungeon-actor' });
  store.markSaved();
  assert.throws(
    () => store.addEntity({ id: 'actor:unique', entityType: 'dungeon-actor' }),
    /已经存在/,
  );
  assert.throws(
    () => store.attachEntity('actor:unique', { kind: 'tile', tileId: 'missing' }),
    /空间目标/,
  );
  assert.equal(store.getDocument().entities.length, 1);
  assert.equal(store.dirty, false);
});

test('订阅者收到修改、撤销、重做和保存事件', () => {
  const store = createStore();
  const sources: string[] = [];
  const unsubscribe = store.subscribe(({ source }) => sources.push(source));
  store.addEntity({ id: 'actor:event', entityType: 'dungeon-actor' });
  store.undo();
  store.redo();
  store.markSaved();
  unsubscribe();
  assert.deepEqual(sources, ['execute', 'undo', 'redo', 'saved']);
});

test('旧 Inspector 容器快照可原子写回 ECS 表', () => {
  const store = createStore();
  const target = { kind: 'tile' as const, tileId: store.getDocument().grid.tileIds[0] };
  store.replaceSpatialContainer(target, {
    entities: [{
      id: 'actor:bridge',
      entityType: 'dungeon-actor',
      name: '桥接 Actor',
      components: [{ id: 'actor:bridge:state', type: 'state', version: 1, current: 'idle' }],
    }],
  });
  assert.equal(store.getDocument().entities[0].name, '桥接 Actor');
  assert.equal(store.getDocument().components.state[0].entityId, 'actor:bridge');
  assert.deepEqual(store.getDocument().components['spatial-attachment'][0].targets, [target]);

  store.replaceSpatialContainer(target, { entities: [] });
  assert.equal(store.getDocument().entities.length, 0);
  assert.equal(Object.values(store.getDocument().components).flat().length, 0);
  store.undo();
  assert.equal(store.getDocument().entities[0].id, 'actor:bridge');
});

test('Inspector 可直接添加 Entity，并按空间目标移除多挂载 Entity', () => {
  const store = createStore();
  const [firstTileId, secondTileId] = store.getDocument().grid.tileIds;
  store.addEntityAt({ kind: 'tile', tileId: firstTileId }, {
    id: 'actor:native-inspector',
    entityType: 'dungeon-actor',
    components: [{ id: 'actor:native-inspector:state', type: 'state', version: 1 }],
  });
  store.attachEntity('actor:native-inspector', { kind: 'tile', tileId: secondTileId });
  store.markSaved();

  store.removeEntityAt({ kind: 'tile', tileId: firstTileId }, 'actor:native-inspector');
  assert.equal(store.getDocument().entities.length, 1);
  assert.deepEqual(store.getDocument().components['spatial-attachment'][0].targets, [
    { kind: 'tile', tileId: secondTileId },
  ]);
  store.removeEntityAt({ kind: 'tile', tileId: secondTileId }, 'actor:native-inspector');
  assert.equal(store.getDocument().entities.length, 0);
  assert.equal(Object.values(store.getDocument().components).flat().length, 0);
  store.undo();
  assert.equal(store.getDocument().entities[0].id, 'actor:native-inspector');
});
