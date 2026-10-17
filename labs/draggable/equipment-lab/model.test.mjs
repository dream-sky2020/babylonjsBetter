import test from 'node:test';
import assert from 'node:assert/strict';
import { catalog, discard, equip, items, optimize, sample, slots, stats, unequipAll } from './model.ts';
import { defaultGrid, defaultPuck, parseGrid, parsePuck } from './layouts.ts';
function totals(game) { return Object.fromEntries(items.map(item => [item.id, (item.kind === 'skill' ? game.actors.reduce((n, actor) => n + (actor.skillStock[item.id] ?? 0), 0) : game.stock[item.id]) + game.actors.reduce((n, actor) => n + Object.values(actor.gear).filter(id => id === item.id).length, 0)])); }
test('装备替换返还旧物品，预览属性和仓库守恒，原数据不被修改', () => {
  const original = sample(); const next = equip(original, 'actor0', 'weapon', 'blade');
  assert.equal(original.actors[0].gear.weapon, 'sword'); assert.equal(next.actors[0].gear.weapon, 'blade');
  assert.deepEqual(totals(next), totals(original)); assert.equal(stats(next.actors[0]).attack - stats(original.actors[0]).attack, 10);
  assert.throws(() => equip(next, 'actor0', 'head', 'blade')); assert.throws(() => equip(next, 'actor0', 'skill9', 'ice'));
});
test('主动与被动使用同一八槽，拒绝重复和超额，没有库存时不可装备', () => {
  let game = sample(); game = equip(game, 'actor0', 'skill3', 'guard');
  assert.equal(stats(game.actors[0]).defense, stats(sample().actors[0]).defense + 6);
  assert.throws(() => equip(game, 'actor0', 'skill4', 'guard'));
  const skills = items.filter(item => item.kind === 'skill' && !Object.values(game.actors[0].gear).includes(item.id));
  for (let index = 0; index < 5; index++) game = equip(game, 'actor0', `skill${index + 4}`, skills[index].id);
  assert.equal(Object.values(game.actors[0].gear).filter(id => id && catalog[id].kind === 'skill').length, 8);
  assert.throws(() => equip(game, 'actor0', 'skill9', 'spark'));
  const exhausted = sample(); exhausted.actors[0].gear.head = null;
  assert.throws(() => equip(exhausted, 'actor0', 'head', 'helm'));
});
test('全部卸下包括技能并返库，最强装备维持库存和技能唯一性', () => {
  const original = sample(); const empty = unequipAll(original, 'actor0');
  assert.ok(Object.values(empty.actors[0].gear).every(id => id === null)); assert.deepEqual(totals(empty), totals(original));
  const optimized = optimize(original, 'actor0'); assert.deepEqual(totals(optimized), totals(original));
  const ids = slots.filter(s => s.kind === 'skill').map(s => optimized.actors[0].gear[s.id]).filter(Boolean);
  assert.equal(new Set(ids).size, ids.length); assert.equal(ids.length, 8); assert.ok(Object.values(optimized.stock).every(n => n >= 0));
});
test('丢弃只减少仓库一份，不卸下已装备物品', () => {
  const original = sample(); const next = discard(original, 'actor0', 'blade'); assert.equal(next.stock.blade, original.stock.blade - 1); assert.deepEqual(next.actors, original.actors);
  assert.throws(() => discard(original, 'actor0', 'helm')); assert.throws(() => discard(original, 'actor0', 'missing'));
});
test('Grid 布局可往返保存、保留重叠，拒绝外部格式和越界', () => {
  const layout = defaultGrid(); layout.items[1].x = 0.5; layout.items[1].y = 0;
  assert.deepEqual(parseGrid(JSON.parse(JSON.stringify(layout))), layout);
  assert.throws(() => parseGrid({ ...layout, lab: 'press-turn' }));
  const invalid = structuredClone(layout); invalid.items[0].w = 49; assert.throws(() => parseGrid(invalid));
  assert.throws(() => parseGrid({ ...layout, items: Array(6).fill(layout.items[0]) }));
});
test('Puck 布局含六种面板，验证嵌套、重复编号和外部组件', () => {
  const data = defaultPuck(); assert.deepEqual(parsePuck(JSON.parse(JSON.stringify(data))), data);
  const invalid = structuredClone(data); invalid.content[0].props.panel = 'battlefield'; assert.throws(() => parsePuck(invalid));
  const duplicate = structuredClone(data); duplicate.content.push(duplicate.content[0]); assert.throws(() => parsePuck(duplicate));
});
