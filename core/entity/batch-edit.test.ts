import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createMutationPlan,
  dedupeBatchContainerTargets,
  listBatchEntityDefinitions,
  resolveBatchComponentGroups,
  resolveBatchEntityGroups,
  resolveBatchFieldValue,
  type BatchContainerTarget,
  type BatchEntityTarget,
} from './batch-edit.ts';
import type { EntityTypeDefinition, IComponent, IEntity, IEntityContainer } from './entity.types.ts';

const component = (id: string, type: string, slot?: string, value?: unknown): IComponent => ({
  id, type, slot, version: 1, value,
});

const entity = (
  id: string,
  entityType: string,
  archetypeId: string | undefined,
  components: IComponent[] = [],
): IEntity => ({ id, entityType, archetypeId, components });

const target = (id: string, entities: IEntity[]): BatchContainerTarget => ({
  id,
  kind: 'tile',
  container: { entities },
});

test('真实容器按 ID 去重', () => {
  const first = target('tile:0,0', []);
  const duplicate = { ...first, container: { entities: [entity('later', 'tile', undefined)] } };
  assert.deepEqual(dedupeBatchContainerTargets([first, duplicate]), [duplicate]);
});

test('Entity 使用 entityType + archetypeId 跨容器匹配', () => {
  const groups = resolveBatchEntityGroups([
    target('a', [entity('a-iron', 'door', 'iron'), entity('a-wood', 'door', 'wood')]),
    target('b', [entity('b-iron', 'door', 'iron'), entity('b-wood', 'door', 'wood')]),
  ]);
  assert.equal(groups.length, 2);
  assert.ok(groups.every((group) => group.compatible));
  assert.deepEqual(groups.map((group) => group.archetypeId), ['iron', 'wood']);
});

test('Component 使用 type + slot 匹配，多实例缺少 slot 时保持不兼容', () => {
  const targets: BatchEntityTarget[] = [
    { containerId: 'a', entity: entity('a', 'tile', undefined, [component('a-enter', 'event', 'on-enter'), component('a-leave', 'event', 'on-leave')]) },
    { containerId: 'b', entity: entity('b', 'tile', undefined, [component('b-enter', 'event', 'on-enter'), component('b-leave', 'event', 'on-leave')]) },
  ];
  const slotted = resolveBatchComponentGroups(targets);
  assert.ok(slotted.every((group) => group.compatible));
  assert.deepEqual(slotted.map((group) => group.slot), ['on-enter', 'on-leave']);

  const ambiguous = resolveBatchComponentGroups([
    { containerId: 'a', entity: entity('a', 'tile', undefined, [component('a1', 'event'), component('a2', 'event')]) },
    { containerId: 'b', entity: entity('b', 'tile', undefined, [component('b1', 'event')]) },
  ]);
  assert.equal(ambiguous[0].compatible, false);
  assert.match(ambiguous[0].reason ?? '', /多个实例/);
});

test('批量 Entity 定义必须同时满足范围、容器兼容和操作开关', () => {
  const compatible: EntityTypeDefinition = {
    type: 'terrain', label: '地形', allowedContainers: ['tile'],
    batch: { scope: 'same-kind', create: true },
  };
  const disabled: EntityTypeDefinition = {
    type: 'hidden', label: '隐藏', allowedContainers: ['tile'],
  };
  assert.deepEqual(listBatchEntityDefinitions([compatible, disabled], [target('a', []), target('b', [])], 'create'), [compatible]);
});

test('批量字段区分相同、混合、缺失并支持无序数组比较', () => {
  const same = [component('a', 'state', undefined, 'open'), component('b', 'state', undefined, 'open')];
  const mixed = [component('a', 'state', undefined, 'open'), component('b', 'state', undefined, 'closed')];
  assert.deepEqual(resolveBatchFieldValue(same, { path: 'value', label: '值', control: 'text' }), { state: 'same', value: 'open' });
  assert.deepEqual(resolveBatchFieldValue(mixed, { path: 'value', label: '值', control: 'text' }), { state: 'mixed' });
  assert.deepEqual(resolveBatchFieldValue([component('a', 'state'), component('b', 'state')], { path: 'missing', label: '缺失', control: 'text' }), { state: 'missing' });
  assert.equal(resolveBatchFieldValue([
    { ...component('a', 'tags'), tags: ['fly', 'ghost'] },
    { ...component('b', 'tags'), tags: ['ghost', 'fly'] },
  ], { path: 'tags', label: '标签', control: 'tags', batch: { editable: true, equality: 'unordered-array' } }).state, 'same');
});

test('MutationPlan 保存修改前后快照并排除无变化目标', () => {
  const targets = [target('a', []), target('b', [])];
  const plan = createMutationPlan('创建实体', 'entity-create', targets, (item): IEntityContainer => (
    item.id === 'a'
      ? { entities: [entity('new', 'tile', undefined)] }
      : item.container
  ));
  assert.equal(plan.blockedReasons.length, 0);
  assert.equal(plan.changes.length, 1);
  assert.equal(plan.changes[0].targetId, 'a');
  assert.equal(plan.changes[0].before.entities.length, 0);
  assert.equal(plan.changes[0].after.entities.length, 1);
});
