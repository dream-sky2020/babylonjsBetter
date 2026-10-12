import type { DungeonEntranceBinding, DungeonExitBinding, DungeonExitLocation } from './dungeonTransition.types';
import { resolveDungeonExitTriggers, type DungeonExitTrigger } from '../entity/components/dungeon-exit.component.ts';
import type { DungeonMapDirection } from '../map/dungeonMap.types.ts';

export type DungeonEntranceData = { entityId: string; entranceId: string; tileX: number; tileY: number; facing: DungeonMapDirection };
export type DungeonExitData = {
  entityId: string; componentId: string; targetMapPresetKey: string; targetEntranceId: string;
  triggers: readonly DungeonExitTrigger[]; location: DungeonExitLocation;
};
export const createDungeonEntranceData = (binding: DungeonEntranceBinding): DungeonEntranceData => ({
  entityId: binding.entity.id, entranceId: binding.component.entranceId,
  tileX: binding.tileX, tileY: binding.tileY, facing: binding.component.facing,
});
/** Drop legacy edge snapshots and ECS objects from shared descriptions. */
export const createDungeonExitData = (binding: DungeonExitBinding): DungeonExitData => {
  const source = binding.location;
  const location: DungeonExitLocation = source.kind === 'tile' ? { kind: 'tile', tileX: source.tileX, tileY: source.tileY }
    : source.kind === 'tile-edge' ? { kind: 'tile-edge', tileX: source.tileX, tileY: source.tileY,
      direction: source.direction, sideId: source.sideId, edgeId: source.edgeId }
    : { kind: 'shared-edge', edgeId: source.edgeId, sides: source.sides.map(side => ({ ...side })) };
  return { entityId: binding.entity.id, componentId: binding.component.id,
    targetMapPresetKey: binding.component.targetMapPresetKey, targetEntranceId: binding.component.targetEntranceId,
    triggers: resolveDungeonExitTriggers(binding.component), location };
};
