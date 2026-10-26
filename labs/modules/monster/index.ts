import type { LabModule, LabModuleCatalog } from '@/labs/kit';
import type { LabSystemManifest } from '@/labs/kit/systemManifest';
import { monsterVisualLibrariesLabModule } from './monster-visual-libraries';
import { monsterBattlefieldLabModule } from './monster-battlefield';
import { monsterVisualLabModule } from './monster-visual';
import { monsterMovementLabModule } from './monster-movement/monsterMovement.labModule';
import { monsterAttackLabModule } from './monster-attack/monsterAttack.labModule';
import { monsterHitLabModule } from './monster-hit/monsterHit.labModule';
import { monsterDeathLabModule } from './monster-death/monsterDeath.labModule';
import { monsterLayoutDebugLabModule } from './monster-layout-debug/monsterLayoutDebug.labModule';
import { monsterDistanceStripesLabModule } from './monster-distance-stripes/monsterDistanceStripes.labModule';

const entries: Array<[LabModule, LabSystemManifest]> = [
  [monsterVisualLibrariesLabModule, { kind: 'configuration', responsibility: '只读取怪物外观和两级条纹，提交前请求实例模块检查引用',
    core: [{ path: 'core/monster/api/monsterApi.ts', symbols: 'requestMonsterLibrary', purpose: '开发接口和静态配置读取' }],
    services: ['monster.visual-libraries'], protocols: ['monster.visual-libraries.reload / changed / validate-references'], scheduling: 'start 或显式重载；异步代次保护' }],
  [monsterBattlefieldLabModule, { kind: 'configuration', responsibility: '实例、选择、布局的唯一持有者；管理对应面板与 LabState',
    core: [{ path: 'core/monster/visual/monsterVisual.types.ts', symbols: 'VisualBattlefield', purpose: '视觉布局契约' }],
    services: ['monster.battlefield.writer', 'monster.battlefield', 'monster.selection'], protocols: ['monster.battlefield.command / changed', 'monster.selection.command / changed'], scheduling: '命令提交；无周期任务' }],
  [monsterVisualLabModule, { kind: 'system', responsibility: '唯一基础渲染器、表现能力注册、测试动作生命周期；持有外观与播放面板',
    core: [{ path: 'core/monster/visual/MonsterVisualRuntime.ts', symbols: 'MonsterVisualRuntime', purpose: '基础渲染与显式能力装配' }],
    services: ['monster.visual.runtime', 'monster.visual-settings'], protocols: ['monster.visual.command / action-changed', '消费实例、选择和外观库变化'], scheduling: '唯一 presentation / 200；按固定能力顺序推进，跟随暂停' }],
  ...[
    [monsterMovementLabModule, 'MonsterMovementController', '移动预设、目标位置、移动命令及面板', 'monster.movement'],
    [monsterAttackLabModule, 'MonsterAttackController', '攻击预设、方向、攻击命令及面板', 'monster.attack'],
    [monsterHitLabModule, 'MonsterHitController', '受击抖动、闪色、播放命令及面板', 'monster.hit'],
    [monsterDeathLabModule, 'MonsterDeathController', '死亡预设、播放命令及面板', 'monster.death'],
    [monsterLayoutDebugLabModule, 'MonsterLayoutHelpers', '编队网格、占位标记及显示开关面板', 'monster.layout'],
    [monsterDistanceStripesLabModule, 'MonsterDistanceStripeRules', '按行距离条纹规则、预设和规则面板', 'monster.distance-stripes'],
  ].map(([module, symbol, responsibility, key]) => [module, {
    kind: 'system', responsibility,
    core: [{ path: 'core/monster/visual/' + symbol + '.ts', symbols: symbol, purpose: responsibility }],
    services: ['消费 monster.visual.runtime；拥有 ' + key + ' 状态'],
    protocols: [key + ' 独立命令；消费实例/选择变化'],
    scheduling: 'setup 注册能力；start 按需读取本模块预设；由唯一渲染任务推进；反向释放能力与面板',
  }] as [LabModule, LabSystemManifest]),
];
export const monsterLabModuleCatalog: LabModuleCatalog = Object.freeze(Object.fromEntries(
  entries.map(([module, manifest]) => [module.id, Object.freeze({ ...module, manifest })]),
));
export * from './monsterVisual.memory';
export * from './monsterVisual.protocol';
export * from './monsterBattlefield.model';
export * from './monster-movement/monsterMovement.memory';
export * from './monster-movement/monsterMovement.protocol';
export * from './monster-attack/monsterAttack.memory';
export * from './monster-attack/monsterAttack.protocol';
export * from './monster-hit/monsterHit.memory';
export * from './monster-hit/monsterHit.protocol';
export * from './monster-death/monsterDeath.memory';
export * from './monster-death/monsterDeath.protocol';
export * from './monster-layout-debug/monsterLayoutDebug.memory';
export * from './monster-layout-debug/monsterLayoutDebug.protocol';
export * from './monster-distance-stripes/monsterDistanceStripes.memory';
export * from './monster-distance-stripes/monsterDistanceStripes.protocol';
