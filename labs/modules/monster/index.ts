import type { LabModuleCatalog } from '@/labs/kit';
import { monsterVisualLibrariesLabModule } from './monster-visual-libraries';
import { monsterBattlefieldLabModule } from './monster-battlefield';
import { monsterVisualLabModule } from './monster-visual';
import { monsterVisualDebugLabModule } from './monster-visual-debug';
import type { LabSystemManifest } from '@/labs/kit/systemManifest';

const manifests: Record<string, LabSystemManifest> = {
  'monster-visual-libraries': { kind: 'system', responsibility: '读取怪物外观、条纹和动作预设；候选全部就绪后替换共享库',
    core: [{ path: 'core/monster/api/monsterApi.ts', symbols: 'requestMonsterLibrary', purpose: '开发接口读取与打包配置回退' }],
    services: ['共享内存 monster.visual-libraries'], protocols: ['monster.visual-libraries.reload / changed'], scheduling: 'start 或显式请求异步读取；代次保护；销毁清空引用' },
  'monster-battlefield': { kind: 'configuration', responsibility: '持有怪物实例和战场布局；校验后提交；恢复 LabState',
    core: [{ path: 'core/monster/visual/MonsterVisualManager.ts', symbols: 'VisualBattlefield / VisualMonster', purpose: '复用视觉输入契约' }],
    services: ['共享内存 monster.battlefield'], protocols: ['monster.battlefield.command / changed'], scheduling: 'start 建立预览；命令触发提交；无周期任务；销毁清空引用' },
  'monster-visual': { kind: 'system', responsibility: '在 Host 场景中装配唯一怪物视觉管理器，不安装玩家、AI 或地牢系统',
    core: [{ path: 'core/monster/visual/MonsterVisualManager.ts', symbols: 'MonsterVisualManager', purpose: '四层精灵、条纹、移动、攻击、受击、死亡' }],
    services: ['申请 monster.visual-libraries / monster.battlefield / monster.visual-settings'],
    protocols: ['monster.visual.command / action-changed；消费战场和资源更新'], scheduling: 'presentation / 200；跟随暂停；反向销毁取消动作并释放 Babylon 资源' },
  'monster-visual-debug': { kind: 'debug', responsibility: '怪物实例选择、显示参数和动作测试；不写正式预设',
    core: [], services: ['申请三块怪物共享内存'], protocols: ['请求战场和表现命令；观察生命周期'], scheduling: '用户输入和离散变化驱动；无轮询；面板随模块销毁' },
};
export const monsterLabModuleCatalog: LabModuleCatalog = Object.freeze(Object.fromEntries([
  monsterVisualLibrariesLabModule, monsterBattlefieldLabModule, monsterVisualLabModule, monsterVisualDebugLabModule,
].map(module => [module.id, Object.freeze({ ...module, manifest: manifests[module.id] })])));
export * from './monsterVisual.memory';
export * from './monsterVisual.protocol';
export * from './monsterBattlefield.model';
