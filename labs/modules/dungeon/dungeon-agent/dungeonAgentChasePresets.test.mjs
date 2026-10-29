import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseDungeonMapDocumentV3 } from '../../../../core/map-document/dungeonMapDocument.storageV3.ts';
import { createDungeonRuntime } from '../../../../core/dungeon-runtime/dungeonRuntime.ts';
import { DungeonAgentSystem } from '../../../../core/dungeon-agent/dungeonAgentSystem.ts';
import { createDefaultDungeonAgentControllerRegistry } from '../../../../core/dungeon-agent/dungeonAgent.controllers.ts';
import { allocateDungeonAgentStorage } from './dungeonAgentStorage.memory.ts';

test('实际测试地图的追踪者从出生位置向玩家靠近', () => {
  for (const [name, x, y] of [['dungeon_map', 9, 7], ['dungeon_map_2', 0, 0]]) {
    const doc = parseDungeonMapDocumentV3(JSON.parse(readFileSync(`config/dungeonMapPresets/${name}.json`, 'utf8')), name);
    const runtime = createDungeonRuntime(doc, { tilePosition: { x, y }, worldPosition: [x, 0, y] }, 'south');
    const storage = allocateDungeonAgentStorage(1, name, runtime);
    const system = new DungeonAgentSystem(runtime, createDefaultDungeonAgentControllerRegistry(), storage.storage);
    const agents = system.state.agents.filter(agent => agent.binding.controller.controllerId === 'chase-player');
    assert.equal(agents.length, 2);
    const distance = agent => Math.abs(agent.tileIndex % runtime.map.width - x) + Math.abs(Math.floor(agent.tileIndex / runtime.map.width) - y);
    const before = agents.map(distance);
    for (let frame = 0; frame < 600; frame++) runtime.movementResolver.tick(1 / 60, delta => system.update(delta));
    agents.forEach((agent, index) => assert.ok(distance(agent) < before[index], `${name}: ${agent.binding.entity.id} 未靠近玩家`));
  }
});
