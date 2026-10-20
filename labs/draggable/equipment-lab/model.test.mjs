import test from 'node:test';
import assert from 'node:assert/strict';
import { catalog, discard, equip, equippedId, items, optimize, sample, slots, stats, unequipAll } from './model.ts';
import { defaultGrid, defaultPuck, parseGrid, parsePuck } from './layouts.ts';
import { attributes, calculateAttributes } from '../../../core/combat/index.ts';
import { equipmentPanelSettings } from './panelSettings.ts';
import { resolvedPanelSettings, updatePanelSetting } from '../../kit/draggable/panelSettings.ts';
function totals(game) { return Object.fromEntries(items.map(item => [item.id, (item.kind === 'skill' ? game.actors.reduce((n, actor) => n + (actor.skillStock[item.id] ?? 0), 0) : (game.stock[item.id] ?? 0) + game.uniques.filter(unit => unit.definitionId === item.id).length) + game.actors.reduce((n, actor) => n + Object.values(actor.gear).filter(unit => unit?.definitionId === item.id).length, 0)])); }
test('装备替换返还旧物品，预览属性和仓库守恒，原数据不被修改', () => {
  const original = sample(); const next = equip(original, 'actor0', 'weapon', 'blade');
  assert.equal(equippedId(original.actors[0], 'weapon'), 'sword'); assert.equal(equippedId(next.actors[0], 'weapon'), 'blade');
  assert.deepEqual(totals(next), totals(original)); assert.equal(stats(next.actors[0]).attack - stats(original.actors[0]).attack, 10);
  assert.throws(() => equip(next, 'actor0', 'head', 'blade')); assert.throws(() => equip(next, 'actor0', 'skill9', 'ice'));
});
test('主动与被动使用同一八槽，拒绝重复和超额，没有库存时不可装备', () => {
  let game = sample(); game = equip(game, 'actor0', 'skill3', 'guard');
  assert.equal(stats(game.actors[0]).defense, stats(sample().actors[0]).defense + 6);
  assert.throws(() => equip(game, 'actor0', 'skill4', 'guard'));
  const skills = items.filter(item => item.kind === 'skill' && !Object.values(game.actors[0].gear).some(unit => unit?.definitionId === item.id));
  for (let index = 0; index < 5; index++) game = equip(game, 'actor0', `skill${index + 4}`, skills[index].id);
  assert.equal(Object.values(game.actors[0].gear).filter(unit => unit && catalog[unit.definitionId].kind === 'skill').length, 8);
  assert.throws(() => equip(game, 'actor0', 'skill9', 'spark'));
  const exhausted = sample(); exhausted.actors[0].gear.head = null;
  assert.throws(() => equip(exhausted, 'actor0', 'head', 'helm'));
});
test('全部卸下包括技能并返库，最强装备维持库存和技能唯一性', () => {
  const original = sample(); const empty = unequipAll(original, 'actor0');
  assert.ok(Object.values(empty.actors[0].gear).every(id => id === null)); assert.deepEqual(totals(empty), totals(original));
  const optimized = optimize(original, 'actor0'); assert.deepEqual(totals(optimized), totals(original));
  const ids = slots.filter(s => s.kind === 'skill').map(s => equippedId(optimized.actors[0], s.id)).filter(Boolean);
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
test('Puck 布局含七种面板，验证嵌套、重复编号和外部组件', () => {
  const data = defaultPuck(); assert.deepEqual(parsePuck(JSON.parse(JSON.stringify(data))), data);
  const invalid = structuredClone(data); invalid.content[0].props.panel = 'battlefield'; assert.throws(() => parsePuck(invalid));
  const duplicate = structuredClone(data); duplicate.content.push(duplicate.content[0]); assert.throws(() => parsePuck(duplicate));
});
test('角色属性目录完整，装备加成只影响对应属性', () => {
  const game = sample(); const actor = game.actors[0]; const values = stats(actor);
  assert.equal(new Set(attributes.map(attribute => attribute.id)).size, attributes.length);
  for (const attribute of attributes) { assert.equal(typeof values[attribute.id], 'number'); assert.ok(attribute.description); assert.equal('lore' in attribute, false); }
  assert.equal(values.maxSp, 20);
  assert.equal(values.maxLevel, 99); assert.equal(values.experienceMultiplier, 1); assert.equal(values.levelUpPoints, 0);
  assert.equal(values.followUpChance, 0); assert.equal(values.comboChance, 0);
  const next = equip(game, actor.id, 'weapon', 'blade');
  assert.equal(stats(next.actors[0]).attack, values.attack + 10);
  assert.equal(stats(next.actors[0]).maxHp, values.maxHp);
  assert.equal(calculateAttributes(values, [{ attack: 2 }, { attack: 3 }]).attack, values.attack + 5);
  assert.equal(values.attack, stats(actor).attack);
  assert.throws(() => calculateAttributes(values, [{ attack: Infinity }]));
});
test('Grid 属性面板的属性版与解释版可保存并严格校验', () => {
  const before = defaultGrid();
  const next = updatePanelSetting(before, 'attributes', 'characterView', 'explanations', before.items.map(item => item.i), equipmentPanelSettings);
  assert.equal(resolvedPanelSettings(next.panelSettings, 'attributes', equipmentPanelSettings).characterView, 'explanations');
  assert.deepEqual(parseGrid(JSON.parse(JSON.stringify(next))), next);
  assert.throws(() => parseGrid({ ...before, panelSettings: { character: { characterView: 'unknown' } } }));
});
