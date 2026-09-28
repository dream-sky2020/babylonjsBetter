import type { LabModule } from '@/tools/lab-kit';

/** 旧入口 ID 只补齐新格子模块的依赖，不再创建重复的 Debug 面板。 */
export const dungeonGridDebugLabModule: LabModule = {
  id: 'dungeon-grid-debug',
  dependencies: ['dungeon-grid'],
  setup() {},
};
