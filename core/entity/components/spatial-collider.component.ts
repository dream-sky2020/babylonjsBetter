import type { ComponentDefinition, IComponent } from '../entity.types.ts';
import { createEntityDataId } from '../entity.utils.ts';

/** Navigation footprint is deliberately independent of continuous geometry. */
export interface ISpatialColliderComponent extends IComponent {
  type: 'spatial-collider';
  response: 'block' | 'trigger';
  footprint: 'center' | 'full-tile';
  shape: 'disc' | 'box' | 'boundary' | 'point';
  radius: number;
  halfWidth: number;
  halfHeight: number;
  offsetX: number;
  offsetY: number;
}

export const validateSpatialCollider = (value: ISpatialColliderComponent): string[] => {
  const errors: string[] = [];
  if (value.version !== 1) errors.push('spatial-collider version 必须是 1。');
  if (!['block', 'trigger'].includes(value.response)) errors.push('response 无效。');
  if (!['center', 'full-tile'].includes(value.footprint)) errors.push('footprint 无效。');
  if (!['disc', 'box', 'boundary', 'point'].includes(value.shape)) errors.push('shape 无效。');
  for (const field of ['radius', 'halfWidth', 'halfHeight'] as const) {
    if (!Number.isFinite(value[field]) || value[field] <= 0) errors.push(`${field} 必须是正有限数。`);
  }
  for (const field of ['offsetX', 'offsetY'] as const) {
    if (!Number.isFinite(value[field])) errors.push(`${field} 必须是有限数。`);
  }
  return errors;
};

export const componentDefinition: ComponentDefinition<ISpatialColliderComponent> = {
  type: 'spatial-collider', version: 1, label: '空间碰撞形状',
  allowedEntityTypes: ['spatial-object', 'obstacle', 'dungeon-agent'], allowMultiple: true,
  batch: { scope: 'compatible', create: true, edit: true, delete: true },
  fields: [
    { path: 'response', label: '响应', control: 'select', options: ['block', 'trigger'].map(value => ({ value, label: value })), batch: { editable: true } },
    { path: 'footprint', label: '导航占位', control: 'select', options: ['center', 'full-tile'].map(value => ({ value, label: value })), batch: { editable: true } },
    { path: 'shape', label: '几何形状', control: 'select', options: ['disc', 'box', 'boundary', 'point'].map(value => ({ value, label: value })), batch: { editable: true } },
    ...(['radius', 'halfWidth', 'halfHeight', 'offsetX', 'offsetY'] as const).map(path => ({ path, label: path, control: 'number' as const, step: 0.05, batch: { editable: true } })),
  ],
  createDefault: () => ({ id: createEntityDataId('component'), type: 'spatial-collider', version: 1, response: 'block', footprint: 'center', shape: 'disc', radius: 0.25, halfWidth: 0.5, halfHeight: 0.5, offsetX: 0, offsetY: 0 }),
  validate: validateSpatialCollider,
};
