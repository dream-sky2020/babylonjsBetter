import type {
  IAgentControllerComponent,
  IFactionComponent,
  IGridAgentComponent,
} from '../entity/index.ts';
import type { DungeonMapDirection } from '../map/index.ts';
import type { DungeonMapDocumentEntity } from '../map-document/index.ts';

export type DungeonAgentBinding = Readonly<{
  entity: DungeonMapDocumentEntity;
  gridAgent: IGridAgentComponent;
  controller: IAgentControllerComponent;
  faction?: IFactionComponent;
  initialTileId: string;
  initialTileIndex: number;
}>;

export type DungeonAgentMovement = {
  kind: 'move' | 'turn';
  fromTileIndex: number;
  toTileIndex: number;
  fromFacing: DungeonMapDirection;
  toFacing: DungeonMapDirection;
  elapsedSeconds: number;
  durationSeconds: number;
};

export type DungeonRuntimeAgent = {
  readonly binding: DungeonAgentBinding;
  tileIndex: number;
  facing: DungeonMapDirection;
  enabled: boolean;
  actionClock: number;
  controllerState?: unknown;
  movement: DungeonAgentMovement | null;
};

export type DungeonAgentRuntimeState = {
  turnNumber: number;
  agents: DungeonRuntimeAgent[];
  agentIndexByEntityId: ReadonlyMap<string, number>;
  occupantsByTile: ReadonlyArray<Set<number>>;
};

export type DungeonAgentMovementBlockedReason =
  | 'agent-not-found'
  | 'agent-disabled'
  | 'movement-in-progress'
  | 'map-boundary'
  | 'terrain'
  | 'movement-obstacle'
  | 'occupied';

export type DungeonAgentMovementResult = Readonly<{
  started: boolean;
  completed: boolean;
  entityId: string;
  fromTileIndex?: number;
  toTileIndex?: number;
  blockedReason?: DungeonAgentMovementBlockedReason;
}>;

export type DungeonAgentTurn = 'left' | 'back' | 'right';
