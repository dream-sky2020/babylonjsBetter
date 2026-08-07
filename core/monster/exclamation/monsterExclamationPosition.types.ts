export type MonsterExclamationPositionConfig = {
  monsterConfigKey: string;
  exclamationPresetKey: string;
  basePresetKey: string;
  exclamationProgress: number;
  baseProgress: number;
  monsterPositionOffset: [number, number, number];
  exclamationOffset: [number, number, number];
  exclamationScale: number;
  baseScale: number;
};

export type MonsterExclamationPositionLibrary = Record<string, MonsterExclamationPositionConfig>;
