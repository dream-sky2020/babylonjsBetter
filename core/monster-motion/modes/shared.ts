import { Vector3 } from '@babylonjs/core';
import type { MonsterMotionSample,MonsterMotionSampleContext } from '../types';

export const number=(parameters:Record<string,unknown>,key:string,fallback=0)=>{const value=Number(parameters[key]);return Number.isFinite(value)?value:fallback};
export const ease=(kind:unknown,t:number)=>kind==='linear'?t:kind==='easeOutBack'?1+2.70158*Math.pow(t-1,3)+1.70158*Math.pow(t-1,2):t<.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2;
export const positionAt=(context:MonsterMotionSampleContext,t:number)=>Vector3.Lerp(context.from,context.to,t);
export const sample=(anchorPosition:Vector3,visualOffset=Vector3.Zero(),rotationZ=0,scaleX=1,scaleY=1,scaleZ=1):MonsterMotionSample=>({anchorPosition,visualOffset,rotationZ,scaleX,scaleY,scaleZ});
