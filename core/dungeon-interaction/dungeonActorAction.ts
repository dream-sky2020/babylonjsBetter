import type { DungeonMapDocumentV2 } from '../map-document/dungeonMapDocument.types.ts';
import { DUNGEON_EIGHT_WAY_MOVEMENT_DIRECTIONS, type DungeonMovementDirection } from '../dungeon-movement/dungeonMovement.direction.ts';

export const DUNGEON_PLAYER_TARGET_ID = '$dungeon-player';
export const dungeonActorActionOptions = [
  { value: 'actor-teleport', label: '传送角色', commandId: 'actor.teleport' },
  { value: 'actor-move-step', label: '让角色走一格', commandId: 'actor.move-step' },
] as const;
export type DungeonActorAction =
  | { type: 'actor-teleport'; targetEntityId: string; tileId: string }
  | { type: 'actor-move-step'; targetEntityId: string; direction: DungeonMovementDirection };
export const isDungeonActorActionType = (type: unknown): type is DungeonActorAction['type'] =>
  dungeonActorActionOptions.some(option => option.value === type);

export function dungeonActorActionFromService(commandId: unknown, parameters?: Readonly<Record<string, unknown>>): DungeonActorAction | undefined {
  const type = dungeonActorActionOptions.find(option => option.commandId === commandId)?.value;
  if (!type) return undefined;
  return (type === 'actor-teleport'
    ? { type, targetEntityId: parameters?.entityId, tileId: parameters?.tileId }
    : { type, targetEntityId: parameters?.entityId, direction: parameters?.direction }) as DungeonActorAction;
}

export function validateDungeonActorReferences(document: DungeonMapDocumentV2, action: DungeonActorAction): string[] {
  const errors: string[] = [];
  if (action.targetEntityId && action.targetEntityId !== DUNGEON_PLAYER_TARGET_ID
    && !document.entities.some(entity => entity.id === action.targetEntityId && entity.entityType === 'dungeon-agent' && entity.enabled !== false)) {
    errors.push('当前地图没有可用的角色「' + action.targetEntityId + '」。');
  }
  if (action.type === 'actor-teleport' && action.tileId && !document.grid.tileIds.includes(action.tileId)) {
    errors.push('当前地图没有落点格「' + action.tileId + '」。');
  }
  return errors;
}

export function readDungeonActorAction(action: unknown): DungeonActorAction | undefined {
  if (!action || typeof action !== 'object' || !('type' in action)) return undefined;
  if (isDungeonActorActionType(action.type)) return action as DungeonActorAction;
  if (action.type === 'service' && 'commandId' in action) {
    return dungeonActorActionFromService(action.commandId, 'parameters' in action ? action.parameters as Record<string, unknown> : undefined);
  }
  return undefined;
}

const validId = (value: unknown) => typeof value === 'string' && !!value.trim() && value.length <= 256;
export const isDungeonActorStepDirection = (value: unknown): value is DungeonMovementDirection =>
  DUNGEON_EIGHT_WAY_MOVEMENT_DIRECTIONS.some(direction => direction === value);

export const createDungeonActorAction = (type: DungeonActorAction['type']): DungeonActorAction =>
  type === 'actor-teleport' ? { type, targetEntityId: '', tileId: '' } : { type, targetEntityId: '', direction: 'north' };

export function validateDungeonActorAction(action: DungeonActorAction, complete: boolean): string[] {
  const errors: string[] = [];
  const checkId = (value: unknown, message: string) => {
    if ((complete || value !== '' && value !== undefined) && !validId(value)) errors.push(message);
  };
  checkId(action.targetEntityId, '请选择有效的目标角色。');
  if (action.type === 'actor-teleport') checkId(action.tileId, '请选择有效的落点格。');
  else if ((complete || action.direction !== undefined) && !isDungeonActorStepDirection(action.direction)) errors.push('请选择有效的移动方向。');
  return errors;
}
