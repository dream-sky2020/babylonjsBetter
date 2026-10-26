import type { MonsterDisplayConfig, VisualBattlefield, VisualMonster } from '@/core/monster';

export type MonsterDisplayOverrides = Pick<MonsterDisplayConfig,
  'scaleSize' | 'scene3dScale' | 'scene3dHeight' | 'scene3dOffsetX' | 'spriteFacingAxis'>;
export type MonsterVisualInstance = VisualMonster & { display?: MonsterDisplayOverrides };
export type MonsterBattlefield = Omit<VisualBattlefield, 'monsters'> & { monsters: MonsterVisualInstance[] };

const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const index = (value: unknown, max: number) => Number.isInteger(value) && Number(value) >= 0 && Number(value) <= max;
const positive = (value: unknown, max: number) => typeof value === 'number' && Number.isFinite(value) && value > 0 && value <= max;

/** Strict snapshot validation; malformed input must not partly replace a live scene. */
export function isMonsterBattlefield(value: unknown): value is MonsterBattlefield {
  if (!record(value) || typeof value.id !== 'string' || !value.id.trim() || typeof value.name !== 'string'
    || !positive(value.width, 32) || !Number.isInteger(value.width) || !positive(value.cellSize, 100)
    || !positive(value.rowSpacing, 100) || !Array.isArray(value.monsters) || value.monsters.length > 100) return false;
  const ids = new Set<string>();
  return value.monsters.every(monster => {
    if (!record(monster) || typeof monster.id !== 'string' || !monster.id.trim() || ids.has(monster.id)
      || typeof monster.typeId !== 'string' || typeof monster.monsterConfigKey !== 'string' || !monster.monsterConfigKey.trim()
      || typeof monster.monsterStripePresetKey !== 'string' || !record(monster.position) || !record(monster.chaos)) return false;
    ids.add(monster.id);
    const p = monster.position, d = monster.display;
    return index(p.row, 100) && index(p.column, Number(value.width) - 1)
      && positive(p.size, Number(value.width)) && Number.isInteger(p.size)
      && typeof p.isOccupyingFullRowCentered === 'boolean'
      && (p.isOccupyingFullRowCentered || Number(p.column) + Number(p.size) <= Number(value.width))
      && [monster.chaos.value, monster.chaos.threshold, monster.chaos.duration].every(n => typeof n === 'number' && Number.isFinite(n))
      && (d === undefined || (record(d) && positive(d.scaleSize, 10000) && positive(d.scene3dScale, 100)
        && typeof d.scene3dHeight === 'number' && Number.isFinite(d.scene3dHeight)
        && typeof d.scene3dOffsetX === 'number' && Number.isFinite(d.scene3dOffsetX)
        && (d.spriteFacingAxis === '+Z' || d.spriteFacingAxis === '-Z')));
  });
}

export function validateMonsterBattlefield(value: unknown): MonsterBattlefield {
  if (!isMonsterBattlefield(value)) throw new Error('怪物战场数据无效：检查唯一实例 ID、行列、尺寸和显示参数。');
  return value;
}

export function createMonsterPreviewBattlefield(configKey: string): MonsterBattlefield {
  return { id: 'monster-visual-preview', name: '怪物视觉测试', width: 6, cellSize: 5, rowSpacing: 12,
    monsters: [{ id: 'preview-monster-1', typeId: configKey, monsterConfigKey: configKey, monsterStripePresetKey: '',
      chaos: { value: 0, threshold: 100, duration: 0 },
      position: { row: 0, column: 0, size: 1, isOccupyingFullRowCentered: true } }] };
}
