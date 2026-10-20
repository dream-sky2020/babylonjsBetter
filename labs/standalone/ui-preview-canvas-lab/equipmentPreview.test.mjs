import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createEquipmentPreview, runEquipmentPreview, equipmentPreviewContext } from './equipmentPreview.ts';
import { parseUiDocument } from '../../../core/ui-document/uiDocument.ts';
import { listUiNodesInPaintOrder } from '../../../core/ui-document/uiDocument.renderer.ts';
test('整备预览选择、属性比较、装备与卸下保留库存总数且不改原状态', () => {
  const original=createEquipmentPreview(); const initial=equipmentPreviewContext(original);
  assert.match(String(initial['stats.attack']), /→/);
  const equipped=runEquipmentPreview(original,'equip');
  assert.equal(equipped.game.actors[0].gear.weapon.definitionId,'blade');
  assert.equal(equipped.game.stock.blade,original.game.stock.blade-1);
  assert.equal(equipped.game.stock.sword,original.game.stock.sword+1);
  assert.equal(original.game.actors[0].gear.weapon.definitionId,'sword');
  assert.doesNotMatch(String(equipmentPreviewContext(equipped)['stats.attack']),/→/);
  const removed=runEquipmentPreview(equipped,'unequip'); assert.equal(removed.game.actors[0].gear.weapon,null);assert.equal(removed.game.stock.blade,original.game.stock.blade);
});
test('换角色与技能槽选择独立，资源不足或不兼容不改游戏状态',()=>{
  let state=runEquipmentPreview(createEquipmentPreview(),'actor:actor1');
  assert.equal(equipmentPreviewContext(state)['actor.name'],'露娜');
  state=runEquipmentPreview(state,'select:heal');assert.equal(state.slotId,'skill3');
  const next=runEquipmentPreview(state,'equip');assert.equal(next.game.actors[1].gear.skill3.definitionId,'heal');
  const invalid=runEquipmentPreview({...state,slotId:'weapon'},'equip');assert.equal(invalid.game,state.game);
  assert.deepEqual(runEquipmentPreview(next,'reset'),createEquipmentPreview());
});
test('整备预设的绑定均能由演示数据提供，所有可视控件在画布内',()=>{
  const doc=parseUiDocument(JSON.parse(readFileSync(new URL('../../../config/dialoguePreviewPresets/equipment_ui.json',import.meta.url),'utf8')));
  const context=equipmentPreviewContext(createEquipmentPreview());
  for(const node of listUiNodesInPaintOrder(doc)){
    for(const binding of Object.values(node.bindings??{}))assert.ok(Object.hasOwn(context,binding.source),binding.source);
    assert.ok(node.layout.x>=0&&node.layout.y>=0&&node.layout.x+node.layout.width<=doc.canvas.width&&node.layout.y+node.layout.height<=doc.canvas.height,node.id);
  }
});
