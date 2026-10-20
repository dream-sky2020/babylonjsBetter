import { catalog, equip, itemKind, previewStats, sample, slots, stats, type Game } from '../../data/equipment.ts';
export type EquipmentPreview = { game: Game; actorId: string; slotId: string; selectedId: string; message: string };
export const createEquipmentPreview = (): EquipmentPreview => ({game:sample(),actorId:'actor0',slotId:'weapon',selectedId:'blade',message:'选择库存装备，再点击装备；切回编辑模式可逐个调整 UI。'});
export function equipmentPreviewContext(state: EquipmentPreview): Record<string, unknown> {
  const actor=state.game.actors.find(actor=>actor.id===state.actorId)!;const current=stats(actor);const selected=catalog[state.selectedId];
  const preview=selected&&slots.find(slot=>slot.id===state.slotId)?.kind===itemKind(selected)?previewStats(actor,state.slotId,selected.id):current;
  const result:Record<string,unknown>={ 'actor.name':actor.name,'actor.job':`${actor.job} · Lv ${current.level} · 可用加点 ${current.levelUpPoints}`,'actor.portrait':actor.name[0], 'actor.status':actor.statuses.join(' / ')||'状态正常', 'selection.name':selected?.name??'未选择装备','selection.description':selected?.description??'', 'message':state.message };
  for(const key of ['hp','maxHp','mp','maxMp','sp','maxSp','experience','experienceToLevel'])result[`actor.${key}`]=current[key as keyof typeof current];
  for(const [key,label] of [['attack','物理攻击'],['defense','物理防御'],['magic','魔法攻击'],['magicDefense','魔法防御'],['speed','速度'],['luck','幸运']]) result[`stats.${key}`]=`${label}   ${current[key as keyof typeof current]}${preview[key as keyof typeof current]!==current[key as keyof typeof current]?` → ${preview[key as keyof typeof current]}`:''}`;
  for(const slot of slots){result[`slot.${slot.id}`]=`${slot.label}    ${catalog[actor.gear[slot.id]?.definitionId??'']?.name??'—'}`;result[`slot.${slot.id}.fill`]=state.slotId===slot.id?'#28465a':'#17283b';}
  for(const id of ['blade','staff','shield','hat','heal','guard']) { const item=catalog[id];const count=item.kind==='skill'?actor.skillStock[id]??0:state.game.stock[id]??0;result[`stock.${id}`]=`${item.name}   ×${count}`;result[`stock.${id}.fill`]=id===state.selectedId?'#28465a':'#17283b'; }
  return result;
}
export function runEquipmentPreview(state:EquipmentPreview,action:string):EquipmentPreview {
  const [kind,id]=action.split(':');
  try {
    if(kind==='reset')return createEquipmentPreview();
    if(kind==='actor'){if(!state.game.actors.some(actor=>actor.id===id))throw new Error('角色不存在。');return {...state,actorId:id,message:'已切换角色。'};}
    if(kind==='slot'){if(!slots.some(slot=>slot.id===id))throw new Error('装备槽不存在。');return {...state,slotId:id,message:'已选择装备槽。'};}
    if(kind==='select'){
      const item=catalog[id];if(!item)throw new Error('物品不存在。');const actor=state.game.actors.find(actor=>actor.id===state.actorId)!;
      const target=slots.find(slot=>slot.id===state.slotId&&slot.kind===itemKind(item))??slots.find(slot=>slot.kind===itemKind(item)&&!actor.gear[slot.id])??slots.find(slot=>slot.kind===itemKind(item));
      if(!target)throw new Error('没有适用位置。');return {...state,selectedId:id,slotId:target.id,message:'已选择物品，属性区显示换装对比。'};
    }
    if(kind==='equip'||kind==='unequip')return {...state,game:equip(state.game,state.actorId,state.slotId,kind==='equip'?state.selectedId:null),message:kind==='equip'?'已装备所选物品。':'已卸下并返还库存。'};
    return state;
  } catch(error){return {...state,message:error instanceof Error?error.message:String(error)};}
}
