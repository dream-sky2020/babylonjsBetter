import { createEntityDataId } from '../entity.utils';
import type { ComponentDefinition, IComponent } from '../entity.types';
import { DEFAULT_OVERHEAD_VIEW, parseOverheadView, type DungeonOverheadViewConfig } from '../../dungeon-view/dungeonOverheadView.ts';

export interface IDungeonOverheadViewComponent extends IComponent, DungeonOverheadViewConfig { type: 'dungeon-overhead-view' }
export const componentDefinition: ComponentDefinition<IDungeonOverheadViewComponent> = {
  type: 'dungeon-overhead-view', version: 1, label: '俯视显示配置',
  description: '唯一设计角度与格子显示比例；不改变运行时移动和格子拓扑。',
  allowedEntityTypes: ['dungeon-overhead-view'], allowMultiple: false,
  fields: [
    { path: 'pitchDeg', label: '俯视角（与地面夹角）', control: 'number', min: 15, max: 89.99, step: 1 },
    { path: 'yawDeg', label: '水平朝向', control: 'number', min: -180, max: 180, step: 1 },
    { path: 'projection', label: '投影', control: 'select', options: [{ value: 'orthographic', label: '正交' }, { value: 'perspective', label: '透视' }] },
    { path: 'orthographicSize', label: '正交垂直半范围', control: 'number', min: .01, max: 10000, step: .1 },
    { path: 'proportion', label: '格子显示比例', control: 'select', options: [{ value: 'original', label: '原比例' }, { value: 'compensate', label: '按俯视角补偿' }, { value: 'manual', label: '手动' }] },
    { path: 'screenAspect', label: '目标屏幕高宽比', control: 'number', min: .1, max: 10, step: .1 },
    { path: 'scaleX', label: '手动 X 倍率', control: 'number', min: .1, max: 20, step: .1 },
    { path: 'scaleZ', label: '手动 Z 倍率', control: 'number', min: .1, max: 20, step: .1 },
    { path: 'restoreDisplayInFirstPerson', label: '切到第一人称时恢复地图原比例', control: 'checkbox' },
  ],
  validate: value => { try { parseOverheadView(value); return []; } catch (e) { return [String(e instanceof Error ? e.message : e)]; } },
  migrate: data => ({ ...DEFAULT_OVERHEAD_VIEW, ...data, id: typeof data.id === 'string' ? data.id : createEntityDataId('component'), type: 'dungeon-overhead-view', version: 1 }),
  createDefault: () => ({ ...DEFAULT_OVERHEAD_VIEW, id: createEntityDataId('component'), type: 'dungeon-overhead-view', version: 1, enabled: true }),
};
