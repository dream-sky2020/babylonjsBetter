import { validateDungeonInteractionDocument } from './dungeonInteraction.validation.ts';
import { createServiceToken } from '../system-runtime/ServiceToken.ts';
import { DungeonMapDocumentQuery } from '../map-document/dungeonMapDocument.query.ts';
import { getDungeonRuntimeNeighbor, type DungeonRuntimeMap } from '../dungeon-runtime/dungeonRuntimeMap.ts';
import { DUNGEON_PLAYER_TRAVERSAL_ACTOR_ID, type DungeonTraversalWorld } from '../dungeon-traversal/dungeonTraversal.ts';
import type { ExecutableInteractionAction, IEventComponent } from '../entity/components/event.component.ts';
import { visualRotationLabels } from '../entity/components/visual-state.component.ts';
import { DUNGEON_EIGHT_WAY_MOVEMENT_DIRECTIONS, type DungeonMovementDirection } from '../dungeon-movement/dungeonMovement.direction.ts';
import { isAgentInteraction, type InteractionQuery } from './DungeonInteractionRouter.ts';
import { describeDungeonInteractions, type InteractionDebugDescriptor } from './dungeonInteraction.debug.ts';
import { interactionArrivalSide, interactionOnceKey, oppositeInteractionSide, relativeInteractionSide, worldInteractionSide } from './dungeonInteraction.direction.ts';

export type InteractionMatch = { id: string; entityId: string; label: string; priority: number; rank: number;
  once: boolean; onceKey: string; directional: boolean; action: ExecutableInteractionAction; actorLabel?: string;
  contactBlockers?: readonly string[]; claimsMovement?: boolean };
export type InteractionDiagnostic = { id: string; entityId: string; label: string; reason: string; matched: boolean;
  onceKey: string; side?: string; facing?: string };
type Session = { loadId: number; map: DungeonRuntimeMap; world: DungeonTraversalWorld; moving(entityId: string): boolean;
  facing?(entityId: string): string | undefined };
export type DungeonInteractionControl = {
  find(query: InteractionQuery, playerRules?: readonly IEventComponent[]): readonly InteractionMatch[];
  explain(query: InteractionQuery): readonly InteractionDiagnostic[];
  describe(loadId: number): readonly InteractionDebugDescriptor[];
  movementBlockers(loadId: number, actorId: string): ReadonlySet<string>;
  observeMovementContact(loadId: number, listener: () => void): () => void;
};
export const DUNGEON_INTERACTION_CONTROL = createServiceToken<DungeonInteractionControl>('dungeon:interaction-control');
export function createDungeonInteractionControl(read: () => Session | null): DungeonInteractionControl {
  const indexes = new WeakMap<DungeonRuntimeMap, DungeonMapDocumentQuery>();
  const evaluate = (input: InteractionQuery, playerRules: readonly IEventComponent[] = input.playerRules ?? []) => {
    const matches: InteractionMatch[] = [], diagnostics: InteractionDiagnostic[] = [];
    const session = read();
    if (!session || session.loadId !== input.loadId) return { matches, diagnostics };
    const { map, world } = session;
    const actorId = input.actorId ?? DUNGEON_PLAYER_TRAVERSAL_ACTOR_ID;
    const agent = isAgentInteraction(input);
    const actor = agent ? world.actors.get(actorId) : undefined;
    const collision = input.trigger === 'move-attempt';
    const phase = input.movementPhase ?? (agent ? 'blocked' : 'contact');
    if (agent && ((!collision && actor?.kind !== 'agent') || !actor?.enabled
      || (input.trigger !== 'enter' && actor.tileIndex !== input.position.tileY * map.width + input.position.tileX))) return { matches, diagnostics };
    const blockerIds = input.blockingEntityIds ?? (collision && !agent && !input.movementPhase
      ? world.inspectStep(actorId, input.position.tileY * map.width + input.position.tileX, input.movementDirection ?? input.facing).blockingEntityIds : []);
    if (collision && !blockerIds.length) return { matches, diagnostics };
    let query = indexes.get(map);
    if (!query) {
      const errors = validateDungeonInteractionDocument(map.document); if (errors.length) throw new Error(errors.join('\n'));
      query = new DungeonMapDocumentQuery(map.document); indexes.set(map, query);
    }
    const front = getDungeonRuntimeNeighbor(map, input.position, input.facing);
    const ownId = query.getTileIdAt(input.position.tileX, input.position.tileY);
    const frontId = front && query.getTileIdAt(front.tileX, front.tileY);
    const side = ownId && query.getSide(ownId, input.facing);
    const actorLabel = agent ? query.getEntity(actorId)?.name ?? actorId : undefined;
    const matchesEntity = (mode: IEventComponent['mover'], id: string | undefined, owner: string, actual: string) =>
      mode === 'self' ? actual === owner : mode === 'entity' ? actual === id : true;
    const rules = [...(map.document.components.event ?? []), ...playerRules.map(rule => ({ ...rule, entityId: DUNGEON_PLAYER_TRAVERSAL_ACTOR_ID }))];
    for (const raw of rules) {
      const event = raw as unknown as IEventComponent;
      if (event.version !== 2 || event.trigger !== input.trigger || !event.action || event.action.type === 'legacy') continue;
      const actionRule = collision && event.ruleKind === 'action';
      const ownerId = raw.entityId;
      const playerOwner = ownerId === DUNGEON_PLAYER_TRAVERSAL_ACTOR_ID;
      const entity = query.getEntity(ownerId), body = world.body(ownerId);
      const ownerName = playerOwner ? '玩家' : entity?.name ?? ownerId;
      const label = event.ruleName ? `${ownerName} · ${event.ruleName}` : ownerName;
      const onceKey = playerOwner && event.onceScope !== 'entity' ? `player-rule:${event.id}` : interactionOnceKey(event, ownerId);
      const row: InteractionDiagnostic = { id: event.id, entityId: ownerId, label, matched: false, reason: '', onceKey };
      diagnostics.push(row);
      const actorScope = event.actorScope ?? (collision && (event.movementPhase === 'blocked' || actionRule) ? 'both' : 'player');
      if (actorScope !== 'both' && actorScope !== (agent ? 'agent' : 'player')) { row.reason = '发起者类型不符合规则'; continue; }
      if ((collision && phase === 'blocked' || agent && event.action.type !== 'visual-state' && event.action.type !== 'service') && event.action.type !== 'message') { row.reason = '该阶段使用地图提示'; continue; }
      if ((!playerOwner && !entity) || entity?.enabled === false || event.enabled === false || body?.enabled === false) { row.reason = '实体或规则已禁用'; continue; }
      if (!collision && body && session.moving(ownerId)) { row.reason = '目标正在移动或转向'; continue; }
      if (entity?.entityType === 'dungeon-agent' && !body) { row.reason = '目标尚未进入当前空间'; continue; }
      if (agent && !collision && (ownerId === actorId || input.trigger === 'interact' && event.targetRule !== 'front')) { row.reason = 'Agent 主动交互只检查面前的其他实体'; continue; }
      let matchedBlockers: readonly string[] = [];
      if (collision) {
        const rulePhase = event.movementPhase ?? (actionRule || agent ? 'blocked' : 'contact');
        if (rulePhase !== phase) { row.reason = '移动处理阶段不符合规则'; continue; }
        if (!matchesEntity(event.mover, event.moverId, ownerId, actorId)) { row.reason = '移动者不符合规则'; continue; }
        matchedBlockers = blockerIds.filter(id => matchesEntity(event.blocker ?? (actionRule ? 'any' : 'self'), event.blockerId, ownerId, id));
        if (!matchedBlockers.length) { row.reason = '实际阻挡者不符合规则'; continue; }
        if (phase === 'contact' && !event.movementPhase && body && session.moving(ownerId)) { row.reason = '目标正在移动或转向'; continue; }
      }
      if (!collision) {
        const wanted = event.targetRule === 'front' ? frontId : ownId;
        const targets = query.getComponents(ownerId, 'spatial-attachment').filter(item => item.enabled !== false)
          .flatMap(item => (item.targets ?? []) as { kind: string; tileId?: string; sideId?: string; edgeId?: string }[]);
        const hit = body && targets.some(target => target.kind === 'tile')
          ? !!wanted && map.topology.tileIds[body.logicalPosition.tileY * map.width + body.logicalPosition.tileX] === wanted
          : targets.some(target => target.kind === 'tile' ? target.tileId === wanted
            : event.targetRule === 'front' && !!side && (target.kind === 'side' ? target.sideId === side.id : target.kind === 'edge' && target.edgeId === side.edgeId));
        if (!hit) { row.reason = '目标不在面前或当前所在格'; continue; }
      }
      if (event.targetRule === 'front' && !collision) {
        const inspection = world.inspectStep(actorId, input.position.tileY * map.width + input.position.tileX, input.facing,
          { ignoreBodyIds: [ownerId], ignoreDynamicOccupancy: true, checkTerrain: false });
        if (inspection.blockedReason && inspection.blockingEntityIds.some(id => id !== ownerId)) { row.reason = '被其他墙体或物体遮挡'; continue; }
        if (inspection.blockedReason === 'map-boundary' && !side) { row.reason = '地图边界外没有目标'; continue; }
      }
      const movementIndex = collision ? DUNGEON_EIGHT_WAY_MOVEMENT_DIRECTIONS.indexOf(input.movementDirection ?? input.facing) : -1;
      const approach: DungeonMovementDirection | null = movementIndex >= 0
        ? DUNGEON_EIGHT_WAY_MOVEMENT_DIRECTIONS[(movementIndex + 4) % 8]
        : input.trigger === 'enter'
        ? interactionArrivalSide(map, input.position, input.from, input.movementDirection)
        : event.targetRule === 'front' ? oppositeInteractionSide(input.facing) : null;
      const directional = !!event.directionSpace && event.directionSpace !== 'any';
      if (event.directionSpace === 'world') {
        const worldSide = approach ? worldInteractionSide(approach) : undefined; row.side = worldSide;
        if (!worldSide || !event.worldSides?.includes(worldSide)) { row.reason = '当前地图侧面不在允许方向中'; continue; }
      } else if (event.directionSpace === 'target-local') {
        const directions = (collision ? matchedBlockers : [ownerId]).map(id => {
          const facing = session.facing?.(id) ?? world.body(id)?.facing
            ?? query.getComponents(id, 'grid-facing').find(value => value.enabled !== false)?.facing as string | undefined;
          return { facing, side: approach && facing ? relativeInteractionSide(approach, facing) : null };
        });
        const match = directions.find(direction => direction.side && event.localSides?.includes(direction.side));
        row.facing = (match ?? directions.find(direction => direction.facing))?.facing;
        row.side = (match ?? directions[0])?.side ?? undefined;
        if (!row.facing) { row.reason = '缺少目标当前逻辑朝向'; continue; }
        if (!match) { row.reason = '当前实体侧面不在允许方向中'; continue; }
      }
      row.matched = true;
      row.reason = event.action.type === 'dialogue' ? `命中规则 → 对话入口 ${event.action.entryNodeId}`
        : event.action.type === 'visual-state' ? `命中规则 → ${event.action.targetEntityId} · ${event.action.operation && event.action.operation !== 'set'
          ? `${event.action.groupId} · ${visualRotationLabels[event.action.operation]}` : `切换为 ${event.action.stateId}`}`
        : event.action.type === 'service' ? `命中规则 → 服务指令 ${event.action.commandId}` : '命中规则 → 显示地图提示';
      matches.push({ id: event.id, entityId: ownerId, label, priority: event.priority ?? 0,
        rank: collision || event.targetRule === 'front' ? 0 : 1, once: event.once === true, onceKey: row.onceKey, directional,
        action: structuredClone(event.action), actorLabel: actionRule && !playerOwner ? ownerName : actorLabel,
        contactBlockers: collision && phase === 'blocked' && event.oncePerContact ? matchedBlockers : undefined,
        claimsMovement: collision && event.movementPhase === 'contact' });
    }
    // Direction-specific rules replace generic rules only within this entity and
    // search position. Cross-entity/provider priority and ambiguity rules stay intact.
    const specific = new Set(matches.filter(match => match.directional).map(match => `${match.entityId}:${match.rank}`));
    const selected = matches.filter(match => {
      if (match.directional || !specific.has(`${match.entityId}:${match.rank}`)) return true;
      const row = diagnostics.find(row => row.id === match.id)!; row.matched = false; row.reason = '已命中本实体的方向规则，通用后备不参与'; return false;
    });
    return { matches: selected, diagnostics };
  };
  return {
    find: (input, playerRules) => evaluate(input, playerRules).matches,
    explain: input => evaluate(input).diagnostics,
    describe(loadId) {
      const session = read();
      return session?.loadId === loadId ? describeDungeonInteractions(session.map, session.world, session.moving, session.facing) : [];
    },
    movementBlockers(loadId, actorId) {
      const session = read();
      return session?.loadId === loadId ? session.world.movementBlockers(actorId) : new Set();
    },
    observeMovementContact(loadId, listener) {
      const session = read();
      return session?.loadId === loadId ? session.world.subscribe(change => {
        if (change.kind !== 'path-reservations-changed') listener();
      }) : () => {};
    },
  };
}
