import type {
  IDungeonEntranceComponent,
  IDungeonExitComponent,
  IEntity,
} from '../entity';
import type {
  DungeonMapDirection,
  DungeonMapEdge,
  DungeonMapEdgeEndpoint,
} from '../map';

export type DungeonEntranceBinding = Readonly<{
  entity: IEntity;
  component: IDungeonEntranceComponent;
  tileX: number;
  tileY: number;
}>;

export type DungeonExitLocation =
  | Readonly<{ kind: 'tile'; tileX: number; tileY: number }>
  | Readonly<{ kind: 'tile-edge'; tileX: number; tileY: number; direction: DungeonMapDirection; edge: DungeonMapEdge }>
  | Readonly<{ kind: 'shared-edge'; sides: readonly DungeonMapEdgeEndpoint[]; edge: DungeonMapEdge }>;

export type DungeonExitBinding = Readonly<{
  entity: IEntity;
  component: IDungeonExitComponent;
  location: DungeonExitLocation;
}>;

export type DungeonTransitionResult = Readonly<{
  transitioned: boolean;
  sourcePresetKey: string;
  targetPresetKey: string;
  targetEntranceId: string;
  reason?: 'busy' | 'switch-rejected';
}>;
