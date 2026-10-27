import { Vector3 } from '@babylonjs/core';
import { createLab } from '@/labs/kit';
import { monsterVisualObjectsLabModule } from '@/labs/modules/monster/monster-visual-objects/monsterVisualObjects.labModule';
import { monsterDissolvePreviewLabModule } from '@/labs/modules/monster/monster-dissolve-preview/monsterDissolvePreview.labModule';
import { dungeonLabModuleCatalog } from '@/labs/modules/dungeon';
import '@/labs/kit/styles.css';

const root = document.querySelector('#root');
if (!(root instanceof HTMLElement)) throw new Error('缺少 Lab 根节点 #root。');
const host = await createLab({ root, title: 'Monster Dissolve · 组合式 Lab',
  description: '在地图场景中编辑怪物视觉对象，选择怪物消散预设，对选中怪物的身体和线稿播放消散；底部两层随进度渐隐。',
  badge: '怪物消散测试', modules: ['dungeon-config', 'monster-dissolve-preview'],
  catalog: { ...dungeonLabModuleCatalog, [monsterVisualObjectsLabModule.id]: monsterVisualObjectsLabModule, [monsterDissolvePreviewLabModule.id]: monsterDissolvePreviewLabModule },
  initialCamera: { mode: 'orbit', orbitCenter: new Vector3(0, 6, 0), orbitYaw: 0, orbitPitchDeg: 8, orbitRadius: 60, fovDeg: 40 },
});
window.addEventListener('beforeunload', () => host.dispose(), { once: true });
