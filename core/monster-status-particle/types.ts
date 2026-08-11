import type { MotionParameterValues } from '@/core/particle-motion';

export type MonsterStatusParticleAnchor='feet'|'body'|'head'|'world';
export type MonsterStatusParticlePreset={
 presetKey:string;name:string;particlePresetKey:string;motionModeId:string;motionParameters:MotionParameterValues;
 anchor:MonsterStatusParticleAnchor;offset:{x:number;y:number;z:number};followMonster:boolean;
 capacity:number;activeCount:number;timeScale:number;sizeScale:number;fieldRadius:number;seed:number;durationSec:number;
};
export type MonsterStatusParticlePresetLibrary=Record<string,MonsterStatusParticlePreset>;
export type MonsterStatusParticleController={pause:()=>void;resume:()=>void;setStack:(stack:number)=>void;dispose:()=>void};
