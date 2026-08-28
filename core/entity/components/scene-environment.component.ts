import { createEntityDataId } from '../entity.utils';
import type { ComponentDefinition, IComponent } from '../entity.types';

/** 地图对大场景环境预设的声明式引用。 */
export interface ISceneEnvironmentComponent extends IComponent {
  type: 'scene-environment';
  presetKey: string;
}

export const componentDefinition: ComponentDefinition<ISceneEnvironmentComponent> = {
  type: 'scene-environment',
  version: 1,
  label: '场景环境',
  description: '通过 presetKey 指定地图使用的大场景环境预设。',
  allowedEntityTypes: ['map'],
  allowMultiple: false,
  fields: [
    {
      path: 'presetKey',
      label: '场景预设 Key',
      control: 'text',
      placeholder: 'minimal-city',
    },
  ],
  createDefault: () => ({
    id: createEntityDataId('component'),
    type: 'scene-environment',
    version: 1,
    enabled: true,
    presetKey: '',
  }),
};
