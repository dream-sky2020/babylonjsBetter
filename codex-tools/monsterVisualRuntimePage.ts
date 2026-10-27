// Existing action modules retain a dedicated regression fixture as the product Lab becomes an object editor.
import { Vector3 } from '@babylonjs/core';
import { createLab } from '@/labs/kit';
import { monsterLabModuleCatalog } from '@/labs/modules/monster';
import { dungeonLabModuleCatalog } from '@/labs/modules/dungeon';
import '@/labs/kit/styles.css';
const host = await createLab({ root: document.querySelector('#root') as HTMLElement, title: '怪物动作模块回归', description: '', badge: 'Verification',
  modules: ['dungeon-config', 'monster-visual', 'monster-layout-debug', 'monster-distance-stripes', 'monster-movement', 'monster-attack', 'monster-hit', 'monster-death'],
  catalog: { ...dungeonLabModuleCatalog, ...monsterLabModuleCatalog },
  initialCamera: { mode: 'orbit', orbitCenter: new Vector3(0, 6, 0), orbitYaw: 0, orbitPitchDeg: 8, orbitRadius: 60, fovDeg: 40 } });
window.addEventListener('beforeunload', () => host.dispose(), { once: true });
