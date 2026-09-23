import type { DungeonMapDirection } from '../../map/dungeonMap.types.ts';
import {
  DUNGEON_SPATIAL_FOOTPRINTS,
  type DungeonSpatialFootprint,
} from '../../dungeon-space/index.ts';
import { createEntityDataId } from '../entity.utils.ts';
import type { ComponentDefinition, IComponent } from '../entity.types.ts';

export interface IGridAgentComponent extends IComponent {
  type: 'grid-agent';
  /** 从地图文档创建 Runtime Agent 时使用的初始朝向。 */
  initialFacing: DungeonMapDirection;
  /** 启用后，该 Agent 在运行时占据并阻挡所在格。 */
  blocksMovement: boolean;
  /** 缺省按 center 兼容旧地图；full-tile 还会阻挡侧邻格的斜向切角。 */
  spatialFootprint?: DungeonSpatialFootprint;
  /** 每经过多少次有效玩家格步获得一次行动机会。 */
  actionPeriod: number;
  /** 同回合冲突结算使用的显式优先级；不得依赖 Entity 数组顺序。 */
  priority: number;
  /** 由运行时移动规则注册表解释，例如 ground、flying。 */
  movementProfileId: string;
}

const DIRECTIONS: readonly DungeonMapDirection[] = ['north', 'east', 'south', 'west'];

export const componentDefinition: ComponentDefinition<IGridAgentComponent> = {
  type: 'grid-agent',
  version: 1,
  label: '格步行动属性',
  description: '声明动态实体的初始朝向、占位方式、行动周期和移动规则配置。',
  allowedEntityTypes: ['dungeon-agent'],
  batch: { scope: 'same-kind', create: true, edit: true, delete: true },
  allowMultiple: false,
  fields: [
    {
      path: 'initialFacing', label: '初始朝向', control: 'select', batch: { editable: true },
      options: [
        { value: 'north', label: '北' },
        { value: 'east', label: '东' },
        { value: 'south', label: '南' },
        { value: 'west', label: '西' },
      ],
    },
    { path: 'blocksMovement', label: '阻挡其他实体', control: 'checkbox', batch: { editable: true } },
    {
      path: 'spatialFootprint', label: '空间占位', control: 'select', batch: { editable: true },
      options: [
        { value: 'center', label: '中心占位（只阻挡目标格）' },
        { value: 'full-tile', label: '整格占位（同时阻挡切角）' },
      ],
    },
    {
      path: 'actionPeriod', label: '行动周期（玩家有效格步）', control: 'number',
      min: 1, step: 1, batch: { editable: true },
    },
    { path: 'priority', label: '冲突优先级', control: 'number', step: 1, batch: { editable: true } },
    {
      path: 'movementProfileId', label: '移动规则 ID', control: 'text',
      placeholder: 'ground', batch: { editable: true },
    },
  ],
  createDefault: () => ({
    id: createEntityDataId('component'),
    type: 'grid-agent',
    version: 1,
    initialFacing: 'south',
    blocksMovement: true,
    spatialFootprint: 'center',
    actionPeriod: 1,
    priority: 0,
    movementProfileId: 'ground',
  }),
  validate: (component) => {
    const errors: string[] = [];
    if (!DIRECTIONS.includes(component.initialFacing)) errors.push('initialFacing 必须是有效的地图方向。');
    if (typeof component.blocksMovement !== 'boolean') errors.push('blocksMovement 必须是布尔值。');
    if (component.spatialFootprint !== undefined
      && !DUNGEON_SPATIAL_FOOTPRINTS.includes(component.spatialFootprint)) {
      errors.push('spatialFootprint 必须是 center 或 full-tile。');
    }
    if (!Number.isInteger(component.actionPeriod) || component.actionPeriod < 1) {
      errors.push('actionPeriod 必须是大于等于 1 的整数。');
    }
    if (!Number.isInteger(component.priority)) errors.push('priority 必须是整数。');
    if (!component.movementProfileId.trim()) errors.push('movementProfileId 不能为空。');
    return errors;
  },
};
