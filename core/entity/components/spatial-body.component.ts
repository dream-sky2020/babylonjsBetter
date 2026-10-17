import type { ComponentDefinition, IComponent } from '../entity.types.ts';
import { createEntityDataId } from '../entity.utils.ts';

/** Initial values only. The attachment owns the initial anchor. */
export interface ISpatialBodyComponent extends IComponent {
  type: 'spatial-body';
  activeByDefault: boolean;
  mobility: 'fixed' | 'movable';
  pushable: boolean;
  initialFacing: 'north' | 'east' | 'south' | 'west';
  movementProfileId: string;
}

export const validateSpatialBody = (value: ISpatialBodyComponent): string[] => {
  const errors: string[] = [];
  if (value.version !== 1) errors.push('spatial-body version 必须是 1。');
  if (typeof value.activeByDefault !== 'boolean') errors.push('activeByDefault 必须是布尔值。');
  if (!['fixed', 'movable'].includes(value.mobility)) errors.push('mobility 必须是 fixed 或 movable。');
  if (typeof value.pushable !== 'boolean') errors.push('pushable 必须是布尔值。');
  if (value.mobility === 'fixed' && value.pushable) errors.push('固定物体不能被推动。');
  if (!['north', 'east', 'south', 'west'].includes(value.initialFacing)) errors.push('initialFacing 无效。');
  if (typeof value.movementProfileId !== 'string' || !value.movementProfileId.trim()) errors.push('movementProfileId 不能为空。');
  for (const field of ['tileX', 'tileY', 'position', 'anchor']) {
    if (field in value) errors.push(`${field} 不能重复保存挂载位置。`);
  }
  return errors;
};

export const componentDefinition: ComponentDefinition<ISpatialBodyComponent> = {
  type: 'spatial-body', version: 1, label: '空间物体',
  description: '初始生效、运动能力与朝向；位置由唯一空间挂载定义。',
  allowedEntityTypes: ['spatial-object', 'obstacle', 'dungeon-agent'],
  allowMultiple: false,
  batch: { scope: 'compatible', create: true, edit: true, delete: true },
  fields: [
    { path: 'activeByDefault', label: '默认生效', control: 'checkbox', batch: { editable: true } },
    { path: 'mobility', label: '运动能力', control: 'select', options: [{ value: 'fixed', label: '固定' }, { value: 'movable', label: '可移动' }], batch: { editable: true } },
    { path: 'pushable', label: '允许推动', control: 'checkbox', batch: { editable: true } },
    { path: 'initialFacing', label: '初始朝向', control: 'select', options: ['north', 'east', 'south', 'west'].map(value => ({ value, label: value })), batch: { editable: true } },
    { path: 'movementProfileId', label: '移动规则', control: 'text', batch: { editable: true } },
  ],
  createDefault: () => ({ id: createEntityDataId('component'), type: 'spatial-body', version: 1, activeByDefault: true, mobility: 'fixed', pushable: false, initialFacing: 'south', movementProfileId: 'ground' }),
  validate: validateSpatialBody,
};
