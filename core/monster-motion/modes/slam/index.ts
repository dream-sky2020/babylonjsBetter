import { Vector3 } from '@babylonjs/core';
import { defineMonsterMotion } from '../../defineMonsterMotion';
import { ease,number,positionAt,sample } from '../shared';

export default defineMonsterMotion({
 id:'slam',name:'冲刺砸地',description:'快速冲到目标上方，重砸落地并短暂压缩。',version:1,
 parameters:{duration:{type:'number',label:'总时长 / 秒',default:.9,min:.1,max:10,step:.05,group:'时间'},travelRatio:{type:'number',label:'冲刺占比',default:.62,min:.2,max:.9,step:.01,group:'时间'},height:{type:'number',label:'砸落高度',default:2.2,min:0,max:12,step:.1,group:'砸地'},squash:{type:'number',label:'冲击压缩',default:.2,min:0,max:.6,step:.01,group:'砸地'},easing:{type:'select',label:'冲刺缓动',default:'easeInOut',options:[{value:'easeInOut',label:'平滑进出'},{value:'linear',label:'线性'}],group:'路径'}},
 sample:(context,parameters)=>{const p=context.progress,ratio=number(parameters,'travelRatio',.62);if(p<ratio){const q=p/ratio,position=positionAt(context,ease(parameters.easing,q));position.y+=number(parameters,'height',2.2)*Math.sin(q*Math.PI*.5);return sample(position)}const q=(p-ratio)/(1-ratio),drop=Math.pow(1-Math.min(1,q/.45),2)*number(parameters,'height',2.2),impact=q>.35?Math.sin(Math.min(1,(q-.35)/.65)*Math.PI)*number(parameters,'squash',.2):0;return sample(context.to.clone(),new Vector3(0,drop,0),0,1+impact,1-impact,1+impact)}
});
