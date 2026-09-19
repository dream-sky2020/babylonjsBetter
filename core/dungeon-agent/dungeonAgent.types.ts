import type {
  IAgentControllerComponent,
  IFactionComponent,
  IGridAgentComponent,
} from '../entity/index.ts';
import type { DungeonMapDirection } from '../map/index.ts';
import type { DungeonMapDocumentEntity } from '../map-document/index.ts';
import type { DungeonTraversalWorld } from '../dungeon-traversal/index.ts';
import type { DungeonMovementResolver } from '../dungeon-movement/index.ts';

export type DungeonAgentBinding = Readonly<{
  entity: DungeonMapDocumentEntity;
  gridAgent: IGridAgentComponent;
  controller: IAgentControllerComponent;
  faction?: IFactionComponent;
  initialTileId: string;
  initialTileIndex: number;
}>;

export type DungeonAgentMovement = {
  kind: 'move' | 'turn' | 'rollback';
  requestId?: string;
  fromTileIndex: number;
  toTileIndex: number;
  fromFacing: DungeonMapDirection;
  toFacing: DungeonMapDirection;
  elapsedSeconds: number;
  durationSeconds: number;
  visualProgress?: number;
  rotationProgress?: number;
};

export type DungeonRuntimeAgent = {
  readonly binding: DungeonAgentBinding;
  tileIndex: number;
  facing: DungeonMapDirection;
  /** Lab 或游戏流程施加的运行时移动优先级覆盖；不会回写地图文档。 */
  priorityOverride?: number;
  enabled: boolean;
  actionClock: number;
  navigationPlan?: DungeonAgentNavigationPlan;
  /** Lab 或游戏流程施加的运行时 Controller 覆盖；不会回写地图文档。 */
  controllerOverride?: DungeonAgentControllerConfig;
  controllerState?: unknown;
  movement: DungeonAgentMovement | null;
};

export type DungeonAgentNavigationPlan = {
  targetTileIndex: number;
  tileIndices: readonly number[];
  directions: readonly DungeonMapDirection[];
  nextStepIndex: number;
  totalCost: number;
  visitedCount: number;
  planSequence: number;
};

export type DungeonAgentControllerConfig = Readonly<{
  controllerId: string;
  parameters: Readonly<Record<string, unknown>>;
}>;

export type DungeonAgentRuntimeState = {
  turnNumber: number;
  agents: DungeonRuntimeAgent[];
  agentIndexByEntityId: ReadonlyMap<string, number>;
  /** 与玩家和静态阻碍共享的权威通行世界。 */
  traversal: DungeonTraversalWorld;
  /** 与玩家共享；管理实际格步的虚占位、提交和回退。 */
  movementResolver: DungeonMovementResolver;
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
