export type MonsterExclamationPositionConfig = {
  monsterConfigKey: string;
  monsterPositionOffset: [number, number, number];
  exclamationOffset: [number, number, number];
};

export type MonsterExclamationPositionLibrary = Record<string, MonsterExclamationPositionConfig>;
