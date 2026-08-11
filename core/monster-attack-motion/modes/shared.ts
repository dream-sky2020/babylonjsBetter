import { Vector3 } from '@babylonjs/core';
import type { MonsterAttackParameterValues,MonsterAttackSample } from '../types';

export const number=(parameters:MonsterAttackParameterValues,key:string,fallback:number)=>{const value=Number(parameters[key]);return Number.isFinite(value)?value:fallback};
export const clamp01=(value:number)=>Math.max(0,Math.min(1,value));
export const smooth=(value:number)=>{const p=clamp01(value);return p*p*(3-2*p)};
export const sample=(visualOffset=new Vector3(),rotationZ=0,scaleX=1,scaleY=1,scaleZ=1):MonsterAttackSample=>({visualOffset,rotationX:0,rotationY:0,rotationZ,scaleX,scaleY,scaleZ});
export const along=(direction:Vector3,distance:number)=>direction.scale(distance);
