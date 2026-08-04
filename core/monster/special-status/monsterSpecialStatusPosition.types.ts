export type MonsterSpecialStatusGlobalConfig = {
  spriteFacingAxis: '+Z' | '-Z';
  statusGroupScale: number;
  statusSpacing: [number, number, number];
  visualPresetKey: string;
};

export type MonsterSpecialStatusEntryConfig = {
  monsterConfigKey: string;
  statusWrapCount: number;
  statusGroupOffset: [number, number, number];
};

export type MonsterSpecialStatusPositionConfig = {
  global: MonsterSpecialStatusGlobalConfig;
  monsters: Record<string, MonsterSpecialStatusEntryConfig>;
};
