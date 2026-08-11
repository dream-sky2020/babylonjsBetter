import { Vector3 } from '@babylonjs/core';
import { defineMonsterMotion } from '../../defineMonsterMotion';
import { ease,number,positionAt,sample } from '../shared';

export default defineMonsterMotion({
 id:'big-jump',name:'大跳落地',description:'一次完整大跳，并在落地时压缩站稳。',version:1,
 parameters:{duration:{type:'number',label:'总时长 / 秒',default:1,min:.1,max:10,step:.05,group:'时间'},travelRatio:{type:'number',label:'腾空占比',default:.78,min:.2,max:.95,step:.01,group:'时间'},height:{type:'number',label:'跳跃高度',default:3,min:0,max:15,step:.1,group:'跳跃'},squash:{type:'number',label:'落地压缩',default:.16,min:0,max:.6,step:.01,group:'落地'},easing:{type:'select',label:'水平缓动',default:'easeInOut',options:[{value:'easeInOut',label:'平滑进出'},{value:'linear',label:'线性'}],group:'路径'}},
 sample:(context,parameters)=>{const ratio=number(parameters,'travelRatio',.78),p=context.progress;if(p<ratio){const q=p/ratio,position=positionAt(context,ease(parameters.easing,q));position.y+=Math.sin(q*Math.PI)*number(parameters,'height',3);return sample(position)}const q=(p-ratio)/(1-ratio),pulse=Math.sin(q*Math.PI)*number(parameters,'squash',.16);return sample(context.to.clone(),Vector3.Zero(),0,1+pulse,1-pulse,1+pulse)}
});
