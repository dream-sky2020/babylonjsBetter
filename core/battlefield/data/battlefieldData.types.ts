import type { Monster } from '@/core/monster/data';

/** 战场核心数据结构 */
export interface Battlefield {
  /** 战场中的怪物列表 */
  monsters: Monster[];
}
