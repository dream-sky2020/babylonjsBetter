import { createEntityDataId } from '../entity.utils.ts';
import type { ComponentDefinition, IComponent } from '../entity.types.ts';

type Offset = [number, number, number];
type VisualSlot = { name: string; offset: Offset; enabled?: boolean };
export type VisualObjectDefinition = VisualSlot & (
  | { kind: 'point-light'; color: string; intensity: number; range: number }
  | { kind: 'sphere'; color: string; diameter: number }
  | { kind: 'model'; modelPath: string }
);
export interface IVisualObjectsComponent extends IComponent {
  type: 'visual-objects';
  objects: VisualObjectDefinition[];
}
export const validVisualId = (value: unknown): value is string =>
  typeof value === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,95}$/.test(value) && !['constructor', 'prototype'].includes(value);
const color = (value: unknown) => typeof value === 'string' && /^#[a-fA-F0-9]{6}$/.test(value);
const positive = (value: unknown) => typeof value === 'number' && Number.isFinite(value) && value > 0;

export function validateVisualObjects(component: IVisualObjectsComponent): string[] {
  if (component.version !== 1 || !Array.isArray(component.objects)) return ['视觉对象组件需要 V1 对象列表。'];
  const names = new Set<string>();
  const errors: string[] = [];
  for (const entry of component.objects) {
    if (!entry || !validVisualId(entry.name) || names.has(entry.name)) { errors.push('视觉对象名称无效或重复。'); continue; }
    names.add(entry.name);
    const validTransform = Array.isArray(entry.offset) && entry.offset.length === 3 && entry.offset.every(Number.isFinite);
    const validEnabled = entry.enabled === undefined || typeof entry.enabled === 'boolean';
    const validShape = entry.kind === 'point-light' ? color(entry.color) && Number.isFinite(entry.intensity) && entry.intensity >= 0 && positive(entry.range)
      : entry.kind === 'sphere' ? color(entry.color) && positive(entry.diameter)
      : entry.kind === 'model' && typeof entry.modelPath === 'string' && /^resources\/[^?#]+\.(glb|gltf)$/i.test(entry.modelPath)
        && !entry.modelPath.includes('\\') && entry.modelPath.split('/').every(part => part && part !== '.' && part !== '..');
    if (!validTransform || !validEnabled || !validShape) errors.push(`视觉对象 ${entry.name} 的类型、偏移或参数无效。`);
  }
  return errors;
}

export const componentDefinition: ComponentDefinition<IVisualObjectsComponent> = {
  type: 'visual-objects', version: 1, label: '加载视觉对象', description: '按本地名称加载灯光、几何体或模型。',
  allowedEntityTypes: ['visual-object'], allowMultiple: false,
  fields: [{ path: 'objects', label: '对象列表（JSON）', control: 'json' }],
  createDefault: () => ({ id: createEntityDataId('component'), type: 'visual-objects', version: 1, objects: [
    { name: 'light', kind: 'point-light', offset: [0, 0.5, 0], color: '#ffdc75', intensity: 1.2, range: 3 },
  ] }),
  validate: validateVisualObjects,
};
