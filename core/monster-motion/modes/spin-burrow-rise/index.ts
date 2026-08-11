import { Vector3 } from '@babylonjs/core';
import { defineMonsterMotion } from '../../defineMonsterMotion';
import { ease,number,positionAt,sample } from '../shared';

export default defineMonsterMotion({
 id:'spin-burrow-rise',name:'旋转钻地再起身',description:'先移动到目标，再旋转钻入地下，停顿后重新起身。',version:1,
 parameters:{duration:{type:'number',label:'总时长 / 秒',default:1.9,min:.2,max:12,step:.05,group:'时间'},travelRatio:{type:'number',label:'移动占比',default:.42,min:.1,max:.8,step:.01,group:'时间'},spinTurns:{type:'number',label:'旋转圈数',default:2.5,min:0,max:12,step:.25,group:'钻地'},burrowDepth:{type:'number',label:'钻地深度',default:2.2,min:0,max:10,step:.1,group:'钻地'},pauseRatio:{type:'number',label:'地下停顿占比',default:.22,min:0,max:.7,step:.01,group:'钻地'},squash:{type:'number',label:'挤压幅度',default:.18,min:0,max:.6,step:.01,group:'钻地'},easing:{type:'select',label:'移动缓动',default:'easeInOut',options:[{value:'easeInOut',label:'平滑进出'},{value:'linear',label:'线性'}],group:'路径'}},
 sample:(context,parameters)=>{const p=context.progress,ratio=number(parameters,'travelRatio',.42);if(p<ratio)return sample(positionAt(context,ease(parameters.easing,p/ratio)));const q=(p-ratio)/(1-ratio),pause=number(parameters,'pauseRatio',.22),downEnd=(1-pause)/2,upStart=downEnd+pause,depth=q<downEnd?q/downEnd:q<upStart?1:Math.max(0,1-(q-upStart)/Math.max(.001,1-upStart)),squash=Math.sin(depth*Math.PI*.5)*number(parameters,'squash',.18);return sample(context.to.clone(),new Vector3(0,-number(parameters,'burrowDepth',2.2)*depth,0),q*number(parameters,'spinTurns',2.5)*Math.PI*2,1+squash,1-squash,1)}
});
