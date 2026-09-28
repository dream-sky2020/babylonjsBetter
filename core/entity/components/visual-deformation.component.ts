import type { ComponentDefinition, IComponent } from '../entity.types';
import { createEntityDataId } from '../entity.utils';
import { DEFAULT_DEFORMATION_SETTINGS, parseDeformationSettings, type DeformationSettings } from '../../render-deformation/deformation.ts';

export type IVisualDeformationComponent = IComponent & DeformationSettings & { type: 'visual-deformation' };
export const componentDefinition: ComponentDefinition<IVisualDeformationComponent> = {
  type: 'visual-deformation', version: 1, label: '显示顶点变形', allowedEntityTypes: ['dungeon-overhead-view'], allowMultiple: false,
  description: '显示对象的倾斜与高度补偿；角度读取同实体的俯视配置，可选择离开俯视后是否恢复原形。',
  fields: [
    { path: 'restoreOutsideOverhead', label: '离开俯视视角时恢复原形', control: 'checkbox' },
    { path: 'selection', label: '作用范围', control: 'select', options: [{ value: 'all', label: '全部已接入对象' }, { value: 'rules', label: '仅匹配规则' }] },
    { path: 'config.mode', label: '变形方式', control: 'select', options: [{ value: 'automatic', label: '按俯角补偿' }, { value: 'manual', label: '手动倾斜' }] },
    { path: 'config.referencePitchDeg', label: '参考俯角', control: 'number', min: 0, max: 89.99, step: 1 },
    { path: 'config.strength', label: '默认强度', control: 'number', min: 0, max: 1, step: .05 },
    { path: 'config.heightScale', label: '高度倍率', control: 'number', min: .25, max: 4, step: .05 },
    { path: 'config.shear', label: '手动倾斜量', control: 'number', min: -4, max: 4, step: .05 },
    { path: 'rules', label: '分组和对象规则', control: 'json' },
  ],
  createDefault: () => ({ ...structuredClone(DEFAULT_DEFORMATION_SETTINGS), enabled: true, id: createEntityDataId('component'), type: 'visual-deformation', version: 1 }),
  validate: value => { try { parseDeformationSettings(value); return []; } catch (e) { return [String(e)]; } },
};
