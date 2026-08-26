import { createEntityDataId } from '../entity.utils';
import type { ComponentDefinition, IComponent } from '../entity.types';

export interface ILegacyDataComponent extends IComponent {
  type: 'legacy-data';
  data: Record<string, unknown>;
}

export const componentDefinition: ComponentDefinition<ILegacyDataComponent> = {
  type: 'legacy-data', version: 1, label: '旧版数据', description: '迁移期间保留的原始数据。', allowMultiple: false,
  fields: [{ path: 'data', label: '原始 JSON', control: 'json' }],
  createDefault: () => ({ id: createEntityDataId('component'), type: 'legacy-data', version: 1, data: {} }),
};
