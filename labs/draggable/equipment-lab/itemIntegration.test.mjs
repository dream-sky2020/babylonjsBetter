import test from 'node:test';
import assert from 'node:assert/strict';
import { actorSkills, catalog, clearEnchantments, discard, enchantEquipped, equip, equipmentSkillDescription, previewStats, sample, stats, useEquipped } from './model.ts';

test('示例装备技能在界面使用中文名称和直白效果', () => {
  assert.deepEqual(catalog.screwdriver.skills.map(equipmentSkillDescription), ['装备后获得「螺丝刀」2级', '装备后「长柄武器」技能等级 +3']);
});

test('装备附魔后独立，卸下返库，再装备并清除附魔可合堆', () => {
  const base = sample();
  let game = equip(base, 'actor0', 'weapon', 'screwdriver');
  assert.deepEqual(actorSkills(game.actors[0]), { screwdriver: 2, 'long-handle': 3 });
  game = enchantEquipped(game, 'actor0', 'weapon', { id: '锋锐', modifiers: [{ attribute: 'attack', stage: 'first', value: 0.1 }] }, 'test-unique-1');
  const enchanted = game.actors[0].gear.weapon;
  assert.equal(enchanted.kind, 'unique');
  assert.equal(stats(game.actors[0]).attack, (game.actors[0].base.attack + 8 + 6) * 1.1);
  game = equip(game, 'actor0', 'weapon', null);
  assert.equal(game.uniques.find(unit => unit.instanceId === 'test-unique-1')?.enchantments.length, 1);
  game = equip(game, 'actor0', 'weapon', 'screwdriver', 'test-unique-1');
  game = clearEnchantments(game, 'actor0', 'weapon');
  assert.equal(game.actors[0].gear.weapon.kind, 'plain');
  game = equip(game, 'actor0', 'weapon', null);
  assert.equal(game.stock.screwdriver, base.stock.screwdriver);
  assert.equal(game.uniques.some(unit => unit.instanceId === 'test-unique-1'), false);
  assert.equal(base.stock.screwdriver, 3);
});

test('选择独立装备时属性预览包含附魔；使用后仅触发耐久损耗', () => {
  let game = sample();
  const relic = game.uniques[0];
  assert.throws(() => discard(game, 'actor0', 'relic'), /独立实例/);
  assert.ok(Math.abs(previewStats(game.actors[0], 'accessory', 'seal').attack - 56.826) < 1e-9);
  assert.equal(previewStats(game.actors[0], 'weapon', 'relic', relic).attack, game.actors[0].base.attack + 18 + 6);
  game = equip(game, 'actor0', 'weapon', 'relic', relic.instanceId);
  let result = useEquipped(game, 'actor0', 'weapon', () => 0.9);
  assert.equal(result.wore, false); assert.equal(result.game.actors[0].gear.weapon.durability, 5);
  result = useEquipped(result.game, 'actor0', 'weapon', () => 0.1);
  assert.equal(result.wore, true); assert.equal(result.destroyed, false); assert.equal(result.game.actors[0].gear.weapon.durability, 4);
  for (let i = 0; i < 4; i++) result = useEquipped(result.game, 'actor0', 'weapon', () => 0.1);
  assert.equal(result.destroyed, true); assert.equal(result.game.actors[0].gear.weapon, null);
});
