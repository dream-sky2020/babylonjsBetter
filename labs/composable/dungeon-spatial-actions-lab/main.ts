import { createLab } from '@/labs/kit';
import { dungeonSpatialActionsLabModule } from '@/labs/modules/dungeon/dungeon-spatial-actions/dungeonSpatialActions.labModule';
import '@/labs/kit/styles.css';
const root=document.querySelector('#root');if(!(root instanceof HTMLElement))throw new Error('缺少根节点。');
const host=await createLab({root,title:'统一空间动作 Lab',description:'验证移动、接触推动、直线换位与轻微错身、打断、窄道通行与安全存档。',badge:'Spatial Actions',
  modules:[dungeonSpatialActionsLabModule.id],catalog:{[dungeonSpatialActionsLabModule.id]:dungeonSpatialActionsLabModule}});
window.addEventListener('beforeunload',()=>host.dispose(),{once:true});
