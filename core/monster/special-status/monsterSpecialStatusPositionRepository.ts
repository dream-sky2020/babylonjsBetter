import type { MonsterSpecialStatusEntryConfig, MonsterSpecialStatusPositionConfig } from './monsterSpecialStatusPosition.types.ts';

export const MONSTER_SPECIAL_STATUS_POSITION_CONFIG_URL = '/config/monsterSpecialStatusPositions.json';

const finite = (value: unknown, fallback: number): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const vector3 = (value: unknown, fallback: [number, number, number]): [number, number, number] => {
  const source = Array.isArray(value) ? value : [];
  return [finite(source[0], fallback[0]), finite(source[1], fallback[1]), finite(source[2], fallback[2])];
};

export const createDefaultMonsterSpecialStatusEntry = (monsterConfigKey: string): MonsterSpecialStatusEntryConfig => ({
  monsterConfigKey,
  statusWrapCount: 4,
  statusGroupOffset: [0, 0, 0],
  statusRowAnchorMode: 'center'
});

export const createDefaultMonsterSpecialStatusPositions = (): MonsterSpecialStatusPositionConfig => ({
  global: { spriteFacingAxis: '+Z', statusGroupScale: 1, statusSpacing: [3, 0, 0], visualPresetKey: '' },
  monsters: {}
});

export const normalizeMonsterSpecialStatusPositions = (value: unknown): MonsterSpecialStatusPositionConfig => {
  const defaults = createDefaultMonsterSpecialStatusPositions();
  if (!value || typeof value !== 'object' || Array.isArray(value)) return defaults;
  const source = value as Record<string, unknown>;
  const rawGlobal = source.global && typeof source.global === 'object' && !Array.isArray(source.global)
    ? source.global as Record<string, unknown> : {};
  const result: MonsterSpecialStatusPositionConfig = {
    global: {
      spriteFacingAxis: rawGlobal.spriteFacingAxis === '-Z' ? '-Z' : '+Z',
      statusGroupScale: Math.max(0.01, finite(rawGlobal.statusGroupScale, 1)),
      statusSpacing: vector3(rawGlobal.statusSpacing, [3, 0, 0]),
      visualPresetKey: typeof rawGlobal.visualPresetKey === 'string' ? rawGlobal.visualPresetKey : ''
    },
    monsters: {}
  };
  const rawMonsters = source.monsters && typeof source.monsters === 'object' && !Array.isArray(source.monsters)
    ? source.monsters as Record<string, unknown> : {};
  for (const [key, raw] of Object.entries(rawMonsters)) {
    if (!key.trim() || !raw || typeof raw !== 'object' || Array.isArray(raw)) continue;
    const entry = raw as Record<string, unknown>;
    result.monsters[key] = {
      monsterConfigKey: key,
      statusWrapCount: Math.max(1, Math.floor(finite(entry.statusWrapCount, 4))),
      statusGroupOffset: vector3(entry.statusGroupOffset, [0, 0, 0]),
      statusRowAnchorMode: entry.statusRowAnchorMode === 'first-row-up' || entry.statusRowAnchorMode === 'first-row-down'
        ? entry.statusRowAnchorMode
        : 'center'
    };
  }
  return result;
};
