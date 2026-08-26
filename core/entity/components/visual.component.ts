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
  allowedEntityTypes: ['map', 'tile', 'tile-edge', 'shared-edge', 'shared-point'],
  fields: [
    { path: 'assetId', label: '资源 ID', control: 'text', optional: true },
    { path: 'color', label: '颜色', control: 'text', optional: true, placeholder: '#ffffff' },
    { path: 'label', label: '显示文本', control: 'text', optional: true },
    { path: 'layer', label: '渲染层', control: 'number', optional: true, step: 1 },
    { path: 'visible', label: '可见', control: 'checkbox', optional: true },
  ],
  createDefault: () => ({ id: createEntityDataId('component'), type: 'visual', version: 1, visible: true }),
};
