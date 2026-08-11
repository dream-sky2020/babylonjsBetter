import { defineMonsterMotion } from '../../defineMonsterMotion';
import { ease,number,positionAt,sample } from '../shared';

export default defineMonsterMotion({
 id:'hopping',name:'蹦蹦跳跳',description:'以多个逐渐收小的跳跃移动到目标点。',version:1,
 parameters:{duration:{type:'number',label:'总时长 / 秒',default:1.3,min:.1,max:10,step:.05,group:'时间'},height:{type:'number',label:'首跳高度',default:1.8,min:0,max:10,step:.1,group:'跳跃'},hopCount:{type:'number',label:'跳跃次数',default:4,min:1,max:12,step:1,group:'跳跃'},decay:{type:'number',label:'高度衰减',default:.45,min:0,max:1,step:.05,group:'跳跃'},easing:{type:'select',label:'水平缓动',default:'linear',options:[{value:'easeInOut',label:'平滑进出'},{value:'linear',label:'线性'}],group:'路径'}},
 sample:(context,parameters)=>{const p=context.progress,position=positionAt(context,ease(parameters.easing,p)),height=number(parameters,'height',1.8)*(1-p*number(parameters,'decay',.45));position.y+=Math.abs(Math.sin(p*Math.PI*number(parameters,'hopCount',4)))*height;return sample(position)}
});
