import type { MonsterMotionDefinition,MonsterMotionParameterSchema,MonsterMotionParameterValues } from './types';

export const defineMonsterMotion=(definition:MonsterMotionDefinition):MonsterMotionDefinition=>definition;
export const createDefaultMonsterMotionParameters=(schema:MonsterMotionParameterSchema):MonsterMotionParameterValues=>Object.fromEntries(Object.entries(schema).map(([key,value])=>[key,value.default]));
export const normalizeMonsterMotionParameters=(schema:MonsterMotionParameterSchema,input:unknown):MonsterMotionParameterValues=>{
 const source=input&&typeof input==='object'?input as Record<string,unknown>:{};
 return Object.fromEntries(Object.entries(schema).map(([key,definition])=>{
  const raw=source[key];
  if(definition.type==='number'){const value=Number(raw);return[key,Math.max(definition.min,Math.min(definition.max,Number.isFinite(value)?value:definition.default))]}
  if(definition.type==='boolean')return[key,typeof raw==='boolean'?raw:definition.default];
  return[key,definition.options.some(option=>option.value===raw)?String(raw):definition.default];
 }));
};
