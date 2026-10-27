import { Vector3 } from '@babylonjs/core';
import { createLab } from '@/labs/kit';
import { monsterVisualObjectsLabModule } from '@/labs/modules/monster/monster-visual-objects/monsterVisualObjects.labModule';
import { dungeonLabModuleCatalog } from '@/labs/modules/dungeon';
import '@/labs/kit/styles.css';

const root = document.querySelector('#root');
if (!(root instanceof HTMLElement)) throw new Error('缺少 Lab 根节点 #root。');
const host = await createLab({
  root, title: 'Monster Visual · 组合式 Lab',
  description: '在地图场景中创建怪物视觉对象，编辑整体与四层精灵的变换和视觉属性；支持撤销、本机保存及 JSON 导入导出。',
  badge: '怪物视觉编辑', modules: ['dungeon-config', 'monster-visual-objects'],
  catalog: { ...dungeonLabModuleCatalog, [monsterVisualObjectsLabModule.id]: monsterVisualObjectsLabModule },
  initialCamera: { mode: 'orbit', orbitCenter: new Vector3(0, 6, 0), orbitYaw: 0, orbitPitchDeg: 8, orbitRadius: 60, fovDeg: 40 },
});
window.addEventListener('beforeunload', () => host.dispose(), { once: true });
