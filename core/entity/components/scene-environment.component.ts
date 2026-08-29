import { createEntityDataId } from '../entity.utils';
import type { ComponentDefinition, IComponent } from '../entity.types';

export const SCENE_ENVIRONMENT_MAP_ANCHOR_MODES = {
  FIRST_TILE: 'first-tile',
  MAP_CENTER: 'map-center',
} as const;

export type SceneEnvironmentMapAnchorMode =
  typeof SCENE_ENVIRONMENT_MAP_ANCHOR_MODES[keyof typeof SCENE_ENVIRONMENT_MAP_ANCHOR_MODES];

export const SCENE_ENVIRONMENT_MAP_ANCHOR_MODE_OPTIONS = [
  { value: SCENE_ENVIRONMENT_MAP_ANCHOR_MODES.FIRST_TILE, label: '首格锚定（偏移对应 0,0 格子底面中心）' },
  { value: SCENE_ENVIRONMENT_MAP_ANCHOR_MODES.MAP_CENTER, label: '整图中心锚定（偏移对应全部格子的 3D 中心）' },
] as const;

/** 地图对大场景环境预设的声明式引用。 */
export interface ISceneEnvironmentComponent extends IComponent {
  type: 'scene-environment';
  presetKey: string;
  mapAnchorMode: SceneEnvironmentMapAnchorMode;
  /** 根据 mapAnchorMode 表示首格底面中心或整张地图的 3D 中心。 */
  mapOffset: readonly [number, number, number];
  /** 相邻地图格子中心在 3D X/Z 轴上的间隔。 */
  tileSpacing: readonly [number, number];
  /** 单个地图格子对应的 3D 区域宽、高、深。 */
  tileSize: readonly [number, number, number];
}

export const DEFAULT_SCENE_ENVIRONMENT_MAP_OFFSET = [0, 0, 0] as const;
export const DEFAULT_SCENE_ENVIRONMENT_MAP_ANCHOR_MODE = SCENE_ENVIRONMENT_MAP_ANCHOR_MODES.FIRST_TILE;
export const DEFAULT_SCENE_ENVIRONMENT_TILE_SPACING = [8, 8] as const;
export const DEFAULT_SCENE_ENVIRONMENT_TILE_SIZE = [7.5, 0.5, 7.5] as const;

const isNumberTuple = (value: unknown, length: number): value is readonly number[] => (
  Array.isArray(value) && value.length === length && value.every((item) => Number.isFinite(item))
);

export const isSceneEnvironmentMapAnchorMode = (value: unknown): value is SceneEnvironmentMapAnchorMode => (
  Object.values(SCENE_ENVIRONMENT_MAP_ANCHOR_MODES).some((mode) => mode === value)
);

export const componentDefinition: ComponentDefinition<ISceneEnvironmentComponent> = {
  type: 'scene-environment',
  version: 3,
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
    {
      path: 'mapAnchorMode',
      label: '地图 3D 锚定方式',
      control: 'select',
      options: SCENE_ENVIRONMENT_MAP_ANCHOR_MODE_OPTIONS,
    },
    { path: 'mapOffset', label: '地图偏移 [X,Y,Z]', control: 'json' },
    { path: 'tileSpacing', label: '格子间隔 [X,Z]', control: 'json' },
    { path: 'tileSize', label: '格子大小 [宽,高,深]', control: 'json' },
  ],
  validate: (component) => [
    ...(!isSceneEnvironmentMapAnchorMode(component.mapAnchorMode) ? ['地图 3D 锚定方式不是允许的固定值。'] : []),
    ...(!isNumberTuple(component.mapOffset, 3) ? ['地图偏移必须是包含 3 个数字的数组。'] : []),
    ...(!isNumberTuple(component.tileSpacing, 2) || component.tileSpacing.some((value) => value <= 0)
      ? ['格子间隔必须是包含 2 个正数的数组。'] : []),
    ...(!isNumberTuple(component.tileSize, 3) || component.tileSize.some((value) => value <= 0)
      ? ['格子大小必须是包含 3 个正数的数组。'] : []),
  ],
  migrate: (data) => ({
    ...data,
    id: typeof data.id === 'string' ? data.id : createEntityDataId('component'),
    type: 'scene-environment',
    version: 3,
    presetKey: typeof data.presetKey === 'string' ? data.presetKey : '',
    mapAnchorMode: isSceneEnvironmentMapAnchorMode(data.mapAnchorMode)
      ? data.mapAnchorMode
      : DEFAULT_SCENE_ENVIRONMENT_MAP_ANCHOR_MODE,
    mapOffset: isNumberTuple(data.mapOffset, 3)
      ? data.mapOffset as [number, number, number]
      : DEFAULT_SCENE_ENVIRONMENT_MAP_OFFSET,
    tileSpacing: isNumberTuple(data.tileSpacing, 2)
      ? data.tileSpacing as [number, number]
      : DEFAULT_SCENE_ENVIRONMENT_TILE_SPACING,
    tileSize: isNumberTuple(data.tileSize, 3)
      ? data.tileSize as [number, number, number]
      : DEFAULT_SCENE_ENVIRONMENT_TILE_SIZE,
  }),
  createDefault: () => ({
    id: createEntityDataId('component'),
    type: 'scene-environment',
    version: 3,
    enabled: true,
    presetKey: '',
    mapAnchorMode: DEFAULT_SCENE_ENVIRONMENT_MAP_ANCHOR_MODE,
    mapOffset: DEFAULT_SCENE_ENVIRONMENT_MAP_OFFSET,
    tileSpacing: DEFAULT_SCENE_ENVIRONMENT_TILE_SPACING,
    tileSize: DEFAULT_SCENE_ENVIRONMENT_TILE_SIZE,
  }),
};
