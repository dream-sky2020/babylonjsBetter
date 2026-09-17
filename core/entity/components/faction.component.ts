import { createEntityDataId } from '../entity.utils.ts';
import type { ComponentDefinition, IComponent } from '../entity.types.ts';

export interface IFactionComponent extends IComponent {
  type: 'faction';
  /** 开放的稳定阵营 ID；敌对关系由后续阵营规则决定，而不是写死在 Entity 类型中。 */
  factionId: string;
}

export const componentDefinition: ComponentDefinition<IFactionComponent> = {
  type: 'faction',
  version: 1,
  label: '阵营',
  description: '声明实体所属阵营；敌对、友好和中立关系由运行时阵营规则解释。',
  allowedEntityTypes: ['dungeon-agent'],
  batch: { scope: 'same-kind', create: true, edit: true, delete: true },
  allowMultiple: false,
  fields: [
    {
      path: 'factionId', label: '阵营 ID', control: 'text',
      placeholder: 'neutral', batch: { editable: true },
    },
  ],
  createDefault: () => ({
    id: createEntityDataId('component'),
    type: 'faction',
    version: 1,
    factionId: 'neutral',
  }),
  validate: (component) => component.factionId.trim() ? [] : ['factionId 不能为空。'],
};
