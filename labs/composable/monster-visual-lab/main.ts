import { Vector3 } from '@babylonjs/core';
import { createLab } from '@/labs/kit';
import { monsterLabModuleCatalog } from '@/labs/modules/monster';
import { dungeonLabModuleCatalog } from '@/labs/modules/dungeon';
import '@/labs/kit/styles.css';

const root = document.querySelector('#root');
if (!(root instanceof HTMLElement)) throw new Error('缺少 Lab 根节点 #root。');
const host = await createLab({
  root, title: 'Monster Visual · 组合式 Lab',
  description: '加载地图场景，测试怪物外观、条纹、实例布局与移动／攻击／受击／死亡表现。配置修改仅在当前会话生效。',
  badge: '怪物视觉测试', modules: [
    'dungeon-config', 'monster-visual', 'monster-layout-debug', 'monster-distance-stripes',
    'monster-movement', 'monster-attack', 'monster-hit', 'monster-death',
  ],
  catalog: { ...dungeonLabModuleCatalog, ...monsterLabModuleCatalog },
  initialCamera: { mode: 'orbit', orbitCenter: new Vector3(0, 6, 0), orbitYaw: 0, orbitPitchDeg: 8, orbitRadius: 60, fovDeg: 40 },
});
window.addEventListener('beforeunload', () => host.dispose(), { once: true });
