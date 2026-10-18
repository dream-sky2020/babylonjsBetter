import test from 'node:test';
import assert from 'node:assert/strict';
import { enchantItem, makeItem, putItem, takeItem } from './inventory.ts';
import { useItem } from './wear.ts';
import { effectiveSkillLevels, itemSkills } from './skills.ts';
import { attributes } from '../combat/attributes.ts';
import { resolveAttributes } from '../combat/modifiers.ts';

const plain = { id: 'screwdriver', name: '螺丝刀', description: '', kind: 'equipment', slot: 'weapon', wear: { kind: 'chanceOnly', breakChance: 0.25 }, modifiers: [], skills: [{ skillId: 'screwdriver', level: 2, mode: 'grant' }, { skillId: 'long-handle', level: 3, mode: 'levelBonus' }] };
const durable = { ...plain, id: 'important-tool', wear: { kind: 'durability', breakChance: 0.5, maxDurability: 3, durabilityLoss: 1 } };

test('五个属性结算阶段顺序固定，独立乘区逐条相乘', () => {
  const base = Object.fromEntries(attributes.map(attribute => [attribute.id, 0])); base.attack = 100;
  const modifiers = [
    { attribute: 'attack', stage: 'base', value: 10 }, { attribute: 'attack', stage: 'flat', value: 20 },
    { attribute: 'attack', stage: 'first', value: 0.2 }, { attribute: 'attack', stage: 'first', value: 0.3 },
    { attribute: 'attack', stage: 'second', value: 0.1 },
    { attribute: 'attack', stage: 'independent', value: 0.2 }, { attribute: 'attack', stage: 'independent', value: 0.3 },
  ];
  assert.equal(resolveAttributes(base, modifiers).attack, 130 * 1.5 * 1.1 * 1.2 * 1.3);
  assert.equal(resolveAttributes(base, modifiers, (_id, value) => value * 2).attack, 240 * 1.5 * 1.1 * 1.2 * 1.3);
  assert.equal(base.attack, 100);
  assert.throws(() => resolveAttributes(base, [{ attribute: 'bad', stage: 'flat', value: 1 }]));
});

test('普通物品堆叠，附魔时拆出实例，清除后可以合回', () => {
  const original = { stacks: { screwdriver: 3 }, uniques: [] };
  const taken = takeItem(original, { kind: 'stack', definitionId: plain.id });
  assert.equal(taken.inventory.stacks.screwdriver, 2); assert.equal(original.stacks.screwdriver, 3);
  const enchanted = enchantItem(taken.item, plain, { id: 'sharp', modifiers: [{ attribute: 'attack', stage: 'first', value: 0.2 }] }, 'unit-1');
  const stored = putItem(taken.inventory, enchanted, plain);
  assert.equal(stored.uniques.length, 1); assert.equal(stored.stacks.screwdriver, 2);
  assert.deepEqual(itemSkills(enchanted, plain).map(skill => skill.level), [2, 3]);
  assert.deepEqual(effectiveSkillLevels({ 'long-handle': 1 }, itemSkills(enchanted, plain)), { 'long-handle': 4, screwdriver: 2 });
  const restored = putItem(taken.inventory, { ...enchanted, enchantments: [] }, plain);
  assert.equal(restored.stacks.screwdriver, 3); assert.equal(restored.uniques.length, 0);
});

test('损耗只在使用后概率触发：普通物品销毁，有耐久物品先降耐久', () => {
  assert.equal(useItem(makeItem(plain), plain, () => 0.8).destroyed, false);
  assert.equal(useItem(makeItem(plain), plain, () => 0.1).destroyed, true);
  const important = makeItem(durable, 'important-1');
  assert.equal(important.durability, 3);
  const first = useItem(important, durable, () => 0.1);
  assert.equal(first.destroyed, false); assert.equal(first.item.durability, 2);
  const second = useItem(first.item, durable, () => 0.8);
  assert.equal(second.item.durability, 2);
  const third = useItem(second.item, durable, () => 0.1);
  assert.equal(third.item.durability, 1);
  assert.equal(useItem(third.item, durable, () => 0.1).destroyed, true);
});
