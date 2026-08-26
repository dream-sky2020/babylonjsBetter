import type { ComponentFieldSchema, IComponent } from '../entity';

/** 穿越一条边时，相对于该边定义方向的通行限制。 */
export type PassableDirectionMode = 'all' | 'none' | 'forward' | 'backward';

/** 实体标签与规则标签之间的匹配方式。 */
export type MatchMode = 'all-of' | 'any-of' | 'none-of';

/** 可挂载在格子、单格边或公用边数据中的声明式物理规则。 */
export interface IPhysicsComponent extends IComponent {
  type: 'physics';
  /** 是否阻挡视线或光线；不参与移动通行判定。 */
  blocksVision?: boolean;
  /** 基础方向限制，缺省时允许正反双向通行。 */
  directionMode?: PassableDirectionMode;
  /** 发起通行的实体需要满足的能力、身份或阵营标签规则。 */
  passRequirement?: {
    mode: MatchMode;
    tags: string[];
  };
  /** 交给游戏逻辑层解析的动态条件，核心层不解释其业务含义。 */
  condition?: {
    expressionId: string;
    params?: Record<string, unknown>;
  };
}

/** 一次通行判定所需的外部上下文。 */
export interface TraversalContext {
  entityTags?: string[];
  evalCondition?: (
    expressionId: string,
    params?: Record<string, unknown>,
  ) => boolean;
}

export type PhysicsComponentFieldSchema = ComponentFieldSchema;

/**
 * PhysicsComponent 的运行时字段描述。
 * TypeScript 接口在运行时会被擦除，编辑器通过此 Schema 自动生成表单。
 */
export const PHYSICS_COMPONENT_FIELD_SCHEMA: readonly PhysicsComponentFieldSchema[] = [
  { path: 'blocksVision', label: '阻挡视线', control: 'checkbox', optional: true },
  {
    path: 'directionMode', label: '方向限制', control: 'select', optional: true,
    options: [
      { value: 'all', label: '双向通行' },
      { value: 'none', label: '完全阻挡' },
      { value: 'forward', label: '仅正向' },
      { value: 'backward', label: '仅反向' },
    ],
  },
  {
    path: 'passRequirement.mode', label: '标签匹配', control: 'select', optional: true,
    options: [
      { value: 'all-of', label: '满足全部' },
      { value: 'any-of', label: '满足任意' },
      { value: 'none-of', label: '不得包含' },
    ],
  },
  {
    path: 'passRequirement.tags', label: '能力 / 身份标签', control: 'tags', optional: true,
    placeholder: 'fly, ghost, faction:elf',
  },
  {
    path: 'condition.expressionId', label: '条件表达式 ID', control: 'text', optional: true,
    placeholder: 'is_night_time',
  },
  {
    path: 'condition.params', label: '条件参数 JSON', control: 'json', optional: true,
    placeholder: '{\n  "switchId": "sw_01"\n}',
  },
] as const;

/** 不包含具体游戏业务规则的纯声明式通行判定器。 */
export class PhysicsEvaluator {
  public static canPass(
    physics: IPhysicsComponent,
    isForward: boolean,
    context: TraversalContext,
  ): boolean {
    const directionMode = physics.directionMode ?? 'all';
    if (directionMode === 'none') return false;
    if (directionMode === 'forward' && !isForward) return false;
    if (directionMode === 'backward' && isForward) return false;

    if (physics.passRequirement) {
      const { mode, tags } = physics.passRequirement;
      const entityTags = new Set(context.entityTags ?? []);
      if (mode === 'all-of' && !tags.every((tag) => entityTags.has(tag))) return false;
      if (mode === 'any-of' && !tags.some((tag) => entityTags.has(tag))) return false;
      if (mode === 'none-of' && tags.some((tag) => entityTags.has(tag))) return false;
    }

    if (physics.condition) {
      if (!context.evalCondition) return false;
      const { expressionId, params } = physics.condition;
      if (!context.evalCondition(expressionId, params)) return false;
    }

    return true;
  }
}
