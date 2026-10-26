import { createLabEvent, createLabRequest } from '../../kit/labCommunication.types.ts';
import type { MonsterBattlefield, MonsterDisplayOverrides } from './monsterBattlefield.model.ts';
import type { MonsterVisualLibraries } from './monsterVisual.memory.ts';

export type BattlefieldCommand =
  | { kind: 'replace'; battlefield: MonsterBattlefield }
  | { kind: 'add'; configKey: string }
  | { kind: 'remove'; monsterId: string }
  | { kind: 'patch'; monsterId: string; configKey?: string; stripeKey?: string; row?: number; column?: number; size?: number; centered?: boolean; display?: MonsterDisplayOverrides | null };
export const monsterBattlefieldCommand = createLabRequest<BattlefieldCommand, void>('monster.battlefield.command');
export const monsterSelectionCommand = createLabRequest<{ selectedId: string }, void>('monster.selection.command');
export const monsterSelectionChanged = createLabEvent<{ selectedId: string }>('monster.selection.changed', 1);
export const monsterLibrariesValidate = createLabRequest<MonsterVisualLibraries, void>('monster.visual-libraries.validate-references');
export const monsterLibrariesReload = createLabRequest<void, void>('monster.visual-libraries.reload');
export const monsterLibrariesChanged = createLabEvent<{ revision: number }>('monster.visual-libraries.changed', 1,
  { label: '怪物视觉预设库已更新', trigger: '全部预设读取并提交后', fields: [{ name: 'revision', type: 'number' }] });
export const monsterBattlefieldChanged = createLabEvent<{ generation: number; kind: 'replace' | 'update' | 'move'; monsterId?: string }>(
  'monster.battlefield.changed', 1, { label: '怪物战场已更新', trigger: '实例或布局提交后', fields: [
    { name: 'generation', type: 'number' }, { name: 'kind', type: 'string' }, { name: 'monsterId', type: 'string', required: false },
    ] });
export type VisualCommand =
  | { kind: 'reset'; monsterId?: string }
  | { kind: 'refresh' };
export const monsterVisualCommand = createLabRequest<VisualCommand, void>('monster.visual.command');
export type MonsterVisualAction = { actionId: number; monsterId: string; kind: 'move' | 'attack' | 'hit' | 'death'; outcome: 'started' | 'completed' | 'cancelled' };
export const monsterVisualActionChanged = createLabEvent<MonsterVisualAction>('monster.visual.action-changed', 1,
  { label: '怪物表现生命周期', trigger: '开始、完成、被替换、重置或销毁时', fields: [
    { name: 'actionId', type: 'number' }, { name: 'monsterId', type: 'string' },
    { name: 'kind', type: 'string' }, { name: 'outcome', type: 'string' }] });
