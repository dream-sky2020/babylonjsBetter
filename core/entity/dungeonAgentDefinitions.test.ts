import assert from 'node:assert/strict';
import test from 'node:test';
import { componentDefinition as controllerDefinition } from './components/agent-controller.component.ts';
import { componentDefinition as factionDefinition } from './components/faction.component.ts';
import { componentDefinition as gridAgentDefinition } from './components/grid-agent.component.ts';
import { entityTypeDefinition as dungeonAgentDefinition } from './entity-types/dungeon-agent.entity-type.ts';

test('dungeon-agent 默认装配格步、控制器和阵营组件', () => {
  assert.deepEqual(dungeonAgentDefinition.allowedContainers, ['tile']);
  assert.deepEqual(dungeonAgentDefinition.requiredComponents, ['grid-agent', 'agent-controller']);
  assert.deepEqual(dungeonAgentDefinition.defaultComponents, ['grid-agent', 'agent-controller', 'faction']);
});

test('可移动实体组件默认值均通过自身校验', () => {
  assert.deepEqual(gridAgentDefinition.validate?.(gridAgentDefinition.createDefault()), []);
  assert.deepEqual(controllerDefinition.validate?.(controllerDefinition.createDefault()), []);
  assert.deepEqual(factionDefinition.validate?.(factionDefinition.createDefault()), []);
  for (const definition of [gridAgentDefinition, controllerDefinition, factionDefinition]) {
    assert.equal(definition.allowMultiple, false);
    assert.deepEqual(definition.allowedEntityTypes, ['dungeon-agent']);
  }
});

test('可移动实体组件拒绝无效的关键配置', () => {
  assert.ok(gridAgentDefinition.validate?.({
    ...gridAgentDefinition.createDefault(),
    actionPeriod: 0,
    priority: 0.5,
    movementProfileId: '',
  }).length);
  assert.ok(controllerDefinition.validate?.({
    ...controllerDefinition.createDefault(),
    controllerId: '',
    parameters: [] as unknown as Record<string, unknown>,
  }).length);
  assert.ok(factionDefinition.validate?.({
    ...factionDefinition.createDefault(),
    factionId: '',
  }).length);
});
