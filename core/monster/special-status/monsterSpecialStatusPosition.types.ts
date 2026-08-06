export type MonsterSpecialStatusGlobalConfig = {
  spriteFacingAxis: '+Z' | '-Z';
  statusGroupScale: number;
  statusSpacing: [number, number, number];
  visualPresetKey: string;
};

export type MonsterSpecialStatusRowAnchorMode = 'center' | 'first-row-up' | 'first-row-down';

export type MonsterSpecialStatusEntryConfig = {
  monsterConfigKey: string;
  statusWrapCount: number;
  statusGroupOffset: [number, number, number];
  statusRowAnchorMode: MonsterSpecialStatusRowAnchorMode;
};

export type MonsterSpecialStatusPositionConfig = {
  global: MonsterSpecialStatusGlobalConfig;
  monsters: Record<string, MonsterSpecialStatusEntryConfig>;
};
