import { defineMonsterMotion } from '../../defineMonsterMotion';
import { ease,number,positionAt,sample } from '../shared';

export default defineMonsterMotion({
 id:'launch-bounce',name:'抛飞弹地',description:'抛物线飞向目标，落地后连续弹跳。',version:1,
 parameters:{duration:{type:'number',label:'总时长 / 秒',default:1.15,min:.1,max:10,step:.05,group:'时间'},travelRatio:{type:'number',label:'抛飞占比',default:.62,min:.2,max:.9,step:.01,group:'时间'},height:{type:'number',label:'抛飞高度',default:4,min:0,max:20,step:.1,group:'抛飞'},bounceHeight:{type:'number',label:'弹地高度',default:1.1,min:0,max:8,step:.1,group:'落地'},bounceCount:{type:'number',label:'弹地次数',default:2,min:1,max:10,step:1,group:'落地'},easing:{type:'select',label:'水平缓动',default:'easeInOut',options:[{value:'easeInOut',label:'平滑进出'},{value:'linear',label:'线性'}],group:'路径'}},
 sample:(context,parameters)=>{const p=context.progress,ratio=number(parameters,'travelRatio',.62);if(p<ratio){const q=p/ratio,position=positionAt(context,ease(parameters.easing,q));position.y+=Math.sin(q*Math.PI)*number(parameters,'height',4);return sample(position)}const q=(p-ratio)/(1-ratio),position=context.to.clone();position.y+=Math.abs(Math.sin(q*Math.PI*number(parameters,'bounceCount',2)))*number(parameters,'bounceHeight',1.1)*(1-q);return sample(position)}
});
