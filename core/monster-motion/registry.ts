import type { MonsterMotionDefinition } from './types';
import { withElasticScale } from './elasticScale';

const modules=import.meta.glob('./modes/*/index.ts',{eager:true,import:'default'}) as Record<string,MonsterMotionDefinition>;
export const monsterMotionDefinitions=Object.values(modules).map(withElasticScale).sort((a,b)=>a.name.localeCompare(b.name,'zh-CN'));
const duplicateIds=monsterMotionDefinitions.map(item=>item.id).filter((id,index,ids)=>ids.indexOf(id)!==index);
if(duplicateIds.length)throw new Error('怪物移动模式 ID 重复：'+[...new Set(duplicateIds)].join(', '));
export const monsterMotionRegistry=new Map(monsterMotionDefinitions.map(item=>[item.id,item]));
export const getMonsterMotionDefinition=(id:string)=>monsterMotionRegistry.get(id)||monsterMotionDefinitions[0];
