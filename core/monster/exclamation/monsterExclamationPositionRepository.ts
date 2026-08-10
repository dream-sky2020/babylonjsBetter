import type { MonsterExclamationIndicatorConfig, MonsterExclamationPositionConfig, MonsterExclamationPositionLibrary } from './monsterExclamationPosition.types.ts';

export const MONSTER_EXCLAMATION_POSITION_CONFIG_URL = '/config/monsterExclamationPositions.json';
const finite=(value:unknown,fallback=0):number=>{const parsed=Number(value);return Number.isFinite(parsed)?parsed:fallback};
const vector3=(value:unknown,fallback:[number,number,number]=[0,0,0]):[number,number,number]=>{const source=Array.isArray(value)?value:[];return[finite(source[0],fallback[0]),finite(source[1],fallback[1]),finite(source[2],fallback[2])]};
const keyOf=(value:unknown):string=>typeof value==='string'?value.trim():'';
const progress=(value:unknown,fallback=1):number=>Math.max(-.1,Math.min(1.1,finite(value,fallback)));

export const createDefaultMonsterExclamationIndicator=(id='indicator_default'):MonsterExclamationIndicatorConfig=>({
 id,name:id,exclamationPresetKey:'',basePresetKey:'',visible:true,order:0,exclamationProgress:1,baseProgress:1,offset:[0,0,0],scale:1,baseScale:1
});
const normalizeIndicator=(value:unknown,index:number):MonsterExclamationIndicatorConfig=>{
 const source=value&&typeof value==='object'&&!Array.isArray(value)?value as Partial<MonsterExclamationIndicatorConfig>:{};
 const id=keyOf(source.id)||`indicator_${index+1}`;
 return{id,name:keyOf(source.name)||id,exclamationPresetKey:keyOf(source.exclamationPresetKey),basePresetKey:keyOf(source.basePresetKey),visible:source.visible!==false,order:Math.round(finite(source.order,index)),exclamationProgress:progress(source.exclamationProgress),baseProgress:progress(source.baseProgress),offset:vector3(source.offset),scale:Math.max(.01,finite(source.scale,1)),baseScale:Math.max(.01,finite(source.baseScale,1))};
};
export const createDefaultMonsterExclamationPosition=(monsterConfigKey:string):MonsterExclamationPositionConfig=>({
 monsterConfigKey,monsterPositionOffset:[0,0,0],groupOffset:[0,3.2,0],groupScale:1,spacing:1.2,indicators:[createDefaultMonsterExclamationIndicator()]
});
export const normalizeMonsterExclamationPositions=(value:unknown):MonsterExclamationPositionLibrary=>{
 if(!value||typeof value!=='object'||Array.isArray(value))return{};
 const result:MonsterExclamationPositionLibrary={};
 for(const[key,raw]of Object.entries(value)){
  if(!key.trim()||!raw||typeof raw!=='object'||Array.isArray(raw))continue;
  const source=raw as Record<string,unknown>;
  let indicators:Array<MonsterExclamationIndicatorConfig>;
  if(Array.isArray(source.indicators)) indicators=source.indicators.map(normalizeIndicator);
  else indicators=[normalizeIndicator({id:'indicator_default',name:'默认标记',exclamationPresetKey:source.exclamationPresetKey,basePresetKey:source.basePresetKey,exclamationProgress:source.exclamationProgress,baseProgress:source.baseProgress,offset:[0,0,0],scale:source.exclamationScale,baseScale:source.baseScale},0)];
  const legacyOffset=vector3(source.exclamationOffset,[0,3.2,0]);
  result[key]={monsterConfigKey:key,monsterPositionOffset:vector3(source.monsterPositionOffset),groupOffset:source.groupOffset?vector3(source.groupOffset):legacyOffset,groupScale:Math.max(.01,finite(source.groupScale,1)),spacing:Math.max(0,finite(source.spacing,1.2)),indicators};
 }
 return result;
};
