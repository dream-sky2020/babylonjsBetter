export type MonsterExclamationIndicatorConfig = {
  id: string;
  name: string;
  exclamationPresetKey: string;
  basePresetKey: string;
  visible: boolean;
  order: number;
  exclamationProgress: number;
  baseProgress: number;
  offset: [number, number, number];
  scale: number;
  baseScale: number;
};

export type MonsterExclamationPositionConfig = {
  monsterConfigKey: string;
  monsterPositionOffset: [number, number, number];
  groupOffset: [number, number, number];
  groupScale: number;
  spacing: number;
  indicators: MonsterExclamationIndicatorConfig[];
};

export type MonsterExclamationPositionLibrary = Record<string, MonsterExclamationPositionConfig>;