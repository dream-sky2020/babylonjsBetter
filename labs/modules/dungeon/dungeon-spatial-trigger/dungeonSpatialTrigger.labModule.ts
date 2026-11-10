import { DUNGEON_INTERACTION_SERVICE, type InteractionQuery } from '@/core/dungeon-interaction/DungeonInteractionRouter';
import { resolveDungeonCardinalFacing } from '@/core/dungeon-movement/dungeonMovement.direction';
import { DUNGEON_PLAYER_STEP_SERVICE_KEY } from '@/core/dungeon-player-movement/dungeonPlayerStepEvents';
import { DUNGEON_PLAYER_TRAVERSAL_ACTOR_ID } from '@/core/dungeon-traversal/dungeonTraversal';
import type { LabModule } from '@/labs/kit';
import { dungeonAgentInteractionEvent } from '../dungeon-agent/dungeonAgent.protocol';
import { DUNGEON_GRID_MEMORY } from '../dungeon-grid/dungeonGrid.memory';
import { DUNGEON_INTERACTION_INPUTS } from '../dungeon-interaction/dungeonInteraction.labModule';
import { dungeonMapChangedEvent } from '../dungeon-map-loader/dungeonMapLoader.protocol';
import { DUNGEON_PLAYER_STATE_MEMORY } from '../dungeon-runtime/dungeonRuntime.memory';
import { PLAYER_MOVEMENT_BLOCKED_ATTEMPT_SERVICE_KEY, type DungeonPlayerBlockedAttemptService } from '../player-movement/playerMovement.blockedAttempt';

export const dungeonSpatialTriggerLabModule: LabModule = {
  id: 'dungeon-spatial-trigger', dependencies: ['dungeon-interaction', 'player-movement'],
  setup(context) {
    const router = context.services.get(DUNGEON_INTERACTION_SERVICE);
    const inputs = context.services.get(DUNGEON_INTERACTION_INPUTS);
    const player = context.memory.acquire(DUNGEON_PLAYER_STATE_MEMORY);
    const grid = context.memory.acquire(DUNGEON_GRID_MEMORY);
    const steps = context.services.get(DUNGEON_PLAYER_STEP_SERVICE_KEY);
    const blocked = context.services.get<DungeonPlayerBlockedAttemptService>(PLAYER_MOVEMENT_BLOCKED_ATTEMPT_SERVICE_KEY);
    let lastStep = 0;
    const offMap = context.communication.on(dungeonMapChangedEvent, () => { lastStep = 0; });
    const offStep = steps.subscribe('dungeon-interaction', 100, event => {
      if (event.loadId !== player.current?.loadId || event.stepId <= lastStep) return;
      lastStep = event.stepId;
      if (router.dispatch({ trigger: 'enter', loadId: event.loadId, position: event.to, from: event.from,
        facing: event.facing, movementDirection: event.movementDirection })) return true;
    });
    const offBlocked = blocked.register(attempt => {
      const current = player.current;
      if (!current) return false;
      return router.dispatch({ trigger: 'move-attempt', loadId: current.loadId, position: attempt.from,
        facing: resolveDungeonCardinalFacing(attempt.direction), movementDirection: attempt.direction,
        blockingEntityIds: attempt.blockedObstacleIds?.filter(id => id !== '$terrain') ?? [],
        attemptId: attempt.attemptId, movementPhase: 'contact' });
    });
    const offPhysicalBlock = blocked.observe(attempt => {
      const current = player.current;
      const blockers = attempt.blockedObstacleIds?.filter(id => id !== '$terrain');
      if (!current) return;
      inputs.reportAttempt(attempt.attemptId, DUNGEON_PLAYER_TRAVERSAL_ACTOR_ID, attempt.outcome);
      if (attempt.outcome !== 'blocked' || !blockers?.length) return;
      router.dispatch({ trigger: 'move-attempt', loadId: current.loadId, position: attempt.from,
        facing: resolveDungeonCardinalFacing(attempt.direction), movementDirection: attempt.direction,
        blockingEntityIds: blockers, attemptId: attempt.attemptId, movementPhase: 'blocked' });
    });
    const offAgent = context.communication.on(dungeonAgentInteractionEvent, ({ loadId, intent }) => {
      const loaded = grid.current;
      if (intent.trigger === 'interact' || loaded?.loadId !== loadId) return;
      const positionAt = (index: number) => ({ tileX: index % loaded.width, tileY: Math.floor(index / loaded.width) });
      const query: InteractionQuery = { actorId: intent.actorId, loadId, trigger: intent.trigger,
        position: positionAt(intent.tileIndex), facing: resolveDungeonCardinalFacing(intent.facing) };
      if (intent.trigger === 'enter') {
        query.from = positionAt(intent.fromTileIndex);
        query.movementDirection = intent.movementDirection;
      } else {
        inputs.reportAttempt(intent.attemptId, intent.actorId, intent.outcome);
        if (intent.outcome !== 'blocked') return;
        query.attemptId = intent.attemptId;
        query.movementPhase = 'blocked';
        query.movementDirection = intent.movementDirection;
        query.blockingEntityIds = intent.blockingEntityIds;
      }
      router.dispatch(query);
    });
    return () => { offAgent(); offPhysicalBlock(); offBlocked(); offStep(); offMap(); };
  },
};
