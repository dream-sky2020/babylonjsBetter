export type MonsterExclamationPositionConfig = {
  monsterConfigKey: string;
  monsterPositionOffset: [number, number, number];
  exclamationOffset: [number, number, number];
  exclamationScale: number;
};

export type MonsterExclamationPositionLibrary = Record<string, MonsterExclamationPositionConfig>;
