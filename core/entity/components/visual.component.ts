import { createEntityDataId } from '../entity.utils';
import type { ComponentDefinition, IComponent } from '../entity.types';

export interface IVisualComponent extends IComponent {
  type: 'visual';
  assetId?: string;
  color?: string;
  label?: string;
  layer?: number;
  visible?: boolean;
}

export const componentDefinition: ComponentDefinition<IVisualComponent> = {
  type: 'visual', version: 1, label: '视觉表现', description: '纹理、模型、颜色和渲染层。',
  allowedEntityTypes: ['tile', 'tile-edge', 'shared-edge', 'shared-point'],
  batch: { scope: 'compatible', create: true, edit: true, delete: true },
  fields: [
    { path: 'assetId', label: '资源 ID', control: 'text', optional: true, batch: { editable: true } },
    { path: 'color', label: '颜色', control: 'text', optional: true, placeholder: '#ffffff', batch: { editable: true } },
    { path: 'label', label: '显示文本', control: 'text', optional: true, batch: { editable: true } },
    { path: 'layer', label: '渲染层', control: 'number', optional: true, step: 1, batch: { editable: true } },
    { path: 'visible', label: '可见', control: 'checkbox', optional: true, batch: { editable: true } },
  ],
  createDefault: () => ({ id: createEntityDataId('component'), type: 'visual', version: 1, visible: true }),
};
