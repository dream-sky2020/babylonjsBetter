import type { Vector3 } from '@babylonjs/core';

export type MonsterAttackParameterDefinition =
  | { type:'number'; label:string; default:number; min:number; max:number; step:number; group?:string }
  | { type:'boolean'; label:string; default:boolean; group?:string }
  | { type:'select'; label:string; default:string; options:Array<{value:string;label:string}>; group?:string };

export type MonsterAttackParameterSchema=Record<string,MonsterAttackParameterDefinition>;
export type MonsterAttackParameterValues=Record<string,number|boolean|string>;
export type MonsterAttackSample={visualOffset:Vector3;rotationX:number;rotationY:number;rotationZ:number;scaleX:number;scaleY:number;scaleZ:number};
export type MonsterAttackSampleContext={progress:number;direction:Vector3};
export type MonsterAttackDefinition={id:string;name:string;description:string;version:number;parameters:MonsterAttackParameterSchema;sample:(context:MonsterAttackSampleContext,parameters:MonsterAttackParameterValues)=>MonsterAttackSample};
export type MonsterAttackPreset={presetKey:string;name:string;modeId:string;parameters:MonsterAttackParameterValues};
export type MonsterAttackPresetLibrary=Record<string,MonsterAttackPreset>;
