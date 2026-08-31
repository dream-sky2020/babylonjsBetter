/** 可写入存档的世界运行时数据。运行状态本身不进入存档。 */
export type WorldRuntimeSnapshot = {
  version: 1;
  worldPresetKey: string;
  playTimeSeconds: number;
};

/** 一个已加载世界的动态运行时；玩家位置和场景变化仍归 DungeonRuntime。 */
export type WorldRuntime = {
  readonly worldPresetKey: string;
  /** 仅在 playTimeRunning=true 时由游戏帧推进。 */
  playTimeSeconds: number;
  /** 暂停、菜单或失焦时可停止累计，但不会清空已有时间。 */
  playTimeRunning: boolean;
};
