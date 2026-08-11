import { defineMonsterMotion } from '../../defineMonsterMotion';
import { ease,number,positionAt,sample } from '../shared';

export default defineMonsterMotion({
 id:'slide-overshoot',name:'滑动冲过头',description:'贴地快速滑动，越过目标后回弹归位。',version:1,
 parameters:{duration:{type:'number',label:'总时长 / 秒',default:.65,min:.05,max:10,step:.05,group:'时间'},travelRatio:{type:'number',label:'到达占比',default:.72,min:.2,max:.95,step:.01,group:'时间'},overshoot:{type:'number',label:'冲出比例',default:.14,min:0,max:1,step:.01,group:'回弹'},easing:{type:'select',label:'移动缓动',default:'easeInOut',options:[{value:'easeInOut',label:'平滑进出'},{value:'linear',label:'线性'}],group:'路径'}},
 sample:(context,parameters)=>{const p=context.progress,ratio=number(parameters,'travelRatio',.72);if(p<ratio)return sample(positionAt(context,ease(parameters.easing,p/ratio)));const q=(p-ratio)/(1-ratio),position=context.to.clone();position.addInPlace(context.direction.scale(context.distance*number(parameters,'overshoot',.14)*Math.sin(q*Math.PI)));return sample(position)}
});
