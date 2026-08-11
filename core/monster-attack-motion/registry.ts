import type { MonsterAttackDefinition } from './types';
const modules=import.meta.glob('./modes/*/index.ts',{eager:true,import:'default'}) as Record<string,MonsterAttackDefinition>;
export const monsterAttackDefinitions=Object.values(modules).sort((a,b)=>a.name.localeCompare(b.name,'zh-CN'));
const duplicateIds=monsterAttackDefinitions.map(item=>item.id).filter((id,index,ids)=>ids.indexOf(id)!==index);
if(duplicateIds.length)throw new Error('怪物攻击模式 ID 重复：'+[...new Set(duplicateIds)].join(', '));
export const monsterAttackRegistry=new Map(monsterAttackDefinitions.map(item=>[item.id,item]));
export const getMonsterAttackDefinition=(id:string)=>monsterAttackRegistry.get(id)||monsterAttackDefinitions[0];
