import { Vector3 } from '@babylonjs/core';
import { defineMonsterMotion } from '../../defineMonsterMotion';
import { ease,number,positionAt,sample } from '../shared';

export default defineMonsterMotion({
 id:'ghost-float',name:'幽灵漂浮',description:'沿目标方向平滑漂移，并持续上下浮动。',version:1,
 parameters:{duration:{type:'number',label:'总时长 / 秒',default:1.2,min:.05,max:10,step:.05,group:'时间'},easing:{type:'select',label:'缓动',default:'easeInOut',options:[{value:'easeInOut',label:'平滑进出'},{value:'linear',label:'线性'},{value:'easeOutBack',label:'越界回弹'}],group:'路径'},amplitude:{type:'number',label:'漂浮幅度',default:.35,min:0,max:5,step:.05,group:'漂浮'},cycles:{type:'number',label:'漂浮周期',default:2,min:1,max:12,step:1,group:'漂浮'},sideDrift:{type:'number',label:'横向摆幅',default:.12,min:0,max:3,step:.02,group:'漂浮'}},
 sample:(context,parameters)=>{const p=context.progress,t=ease(parameters.easing,p),position=positionAt(context,t),cycles=number(parameters,'cycles',2);position.y+=Math.sin(p*Math.PI*2*cycles)*number(parameters,'amplitude',.35);const side=new Vector3(-context.direction.z,0,context.direction.x);position.addInPlace(side.scale(Math.sin(p*Math.PI*cycles)*number(parameters,'sideDrift',.12)));return sample(position)}
});
