import type { Vector3 } from '@babylonjs/core';

export type MonsterMotionParameterDefinition =
  | { type:'number'; label:string; default:number; min:number; max:number; step:number; group?:string }
  | { type:'boolean'; label:string; default:boolean; group?:string }
  | { type:'select'; label:string; default:string; options:Array<{value:string;label:string}>; group?:string };

export type MonsterMotionParameterSchema=Record<string,MonsterMotionParameterDefinition>;
export type MonsterMotionParameterValues=Record<string,number|boolean|string>;
export type MonsterMotionSample={anchorPosition:Vector3;visualOffset:Vector3;rotationZ:number;scaleX:number;scaleY:number;scaleZ:number};
export type MonsterMotionSampleContext={progress:number;from:Vector3;to:Vector3;direction:Vector3;distance:number};
export type MonsterMotionDefinition={
 id:string;name:string;description:string;version:number;parameters:MonsterMotionParameterSchema;
 sample:(context:MonsterMotionSampleContext,parameters:MonsterMotionParameterValues)=>MonsterMotionSample;
};
export type MonsterMotionPreset={presetKey:string;name:string;modeId:string;parameters:MonsterMotionParameterValues};
export type MonsterMotionPresetLibrary=Record<string,MonsterMotionPreset>;
