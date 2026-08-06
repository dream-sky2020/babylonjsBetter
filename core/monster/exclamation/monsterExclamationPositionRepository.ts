import type {
  MonsterExclamationPositionConfig,
  MonsterExclamationPositionLibrary
} from './monsterExclamationPosition.types.ts';

export const MONSTER_EXCLAMATION_POSITION_CONFIG_URL = '/config/monsterExclamationPositions.json';

const finite = (value: unknown, fallback = 0): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const vector3 = (value: unknown): [number, number, number] => {
  const source = Array.isArray(value) ? value : [];
  return [finite(source[0]), finite(source[1]), finite(source[2])];
};

export const createDefaultMonsterExclamationPosition = (monsterConfigKey: string): MonsterExclamationPositionConfig => ({
  monsterConfigKey,
  monsterPositionOffset: [0, 0, 0],
  exclamationOffset: [0, 3.2, 0],
  exclamationScale: 1
});

export const normalizeMonsterExclamationPositions = (value: unknown): MonsterExclamationPositionLibrary => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const result: MonsterExclamationPositionLibrary = {};
  for (const [key, raw] of Object.entries(value)) {
    if (!key.trim() || !raw || typeof raw !== 'object' || Array.isArray(raw)) continue;
    const source = raw as Partial<MonsterExclamationPositionConfig>;
    result[key] = {
      monsterConfigKey: key,
      monsterPositionOffset: vector3(source.monsterPositionOffset),
      exclamationOffset: vector3(source.exclamationOffset),
      exclamationScale: Math.max(0.01, finite(source.exclamationScale, 1))
    };
  }
  return result;
};
