import { createLab } from '@/tools/lab-kit';
import { dungeonLabModuleCatalog } from '@/tools/lab-modules/dungeon';
import '@/tools/lab-kit/styles.css';

const root = document.querySelector('#root');
if (!(root instanceof HTMLElement)) throw new Error('缺少 Lab 根节点 #root。');

const host = await createLab({
  root,
  title: '地牢大场景加载 Lab',
  description: '选择地图预设，通过 map Entity 的 scene-environment 组件加载大场景。',
  badge: 'Composable Lab · dungeon-grid-debug 自动解析依赖',
  modules: ['dungeon-config', 'dungeon-grid-debug'],
  catalog: dungeonLabModuleCatalog,
});
window.addEventListener('beforeunload', () => host.dispose(), { once: true });
