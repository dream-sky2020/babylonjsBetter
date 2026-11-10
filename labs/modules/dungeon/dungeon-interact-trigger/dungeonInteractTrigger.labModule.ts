import { DUNGEON_INTERACTION_SERVICE } from '@/core/dungeon-interaction/DungeonInteractionRouter';
import { resolveDungeonCardinalFacing } from '@/core/dungeon-movement/dungeonMovement.direction';
import type { LabModule } from '@/labs/kit';
import { dungeonAgentInteractionEvent } from '../dungeon-agent/dungeonAgent.protocol';
import { DUNGEON_GRID_MEMORY } from '../dungeon-grid/dungeonGrid.memory';
import { DUNGEON_INTERACTION_INPUTS } from '../dungeon-interaction/dungeonInteraction.labModule';
import { DUNGEON_PLAYER_STATE_MEMORY } from '../dungeon-runtime/dungeonRuntime.memory';

export const dungeonInteractTriggerLabModule: LabModule = {
  id: 'dungeon-interact-trigger', dependencies: ['dungeon-interaction'],
  setup(context) {
    const router = context.services.get(DUNGEON_INTERACTION_SERVICE);
    const inputs = context.services.get(DUNGEON_INTERACTION_INPUTS);
    const player = context.memory.acquire(DUNGEON_PLAYER_STATE_MEMORY);
    const grid = context.memory.acquire(DUNGEON_GRID_MEMORY);
    const interact = () => {
      const current = player.current;
      const handled = !!current && router.dispatch({ trigger: 'interact', loadId: current.loadId,
        position: { ...current.playerPosition }, facing: current.playerFacing });
      if (!handled) inputs.reportInteractMiss();
      return handled;
    };
    const settings = inputs.keyboardSettings();
    const keyboard = context.keyboard.register({ id: 'dungeon-interaction', label: '地牢主动交互', keys: [settings.key], enabled: settings.enabled,
      priority: 70, intercept: true, preventDefault: true,
      onKeyDown: event => event.repeat ? 'handled' : interact() ? 'handled' : 'ignored' });
    const unbind = inputs.bindInteract(interact);
    const offSettings = inputs.onKeyboardSettings(() => {
      const current = inputs.keyboardSettings();
      keyboard.setEnabled(current.enabled); keyboard.setKeys([current.key]);
    });
    const offAgent = context.communication.on(dungeonAgentInteractionEvent, ({ loadId, intent }) => {
      const loaded = grid.current;
      if (intent.trigger !== 'interact' || loaded?.loadId !== loadId) return;
      router.dispatch({ trigger: 'interact', loadId, actorId: intent.actorId,
        position: { tileX: intent.tileIndex % loaded.width, tileY: Math.floor(intent.tileIndex / loaded.width) },
        facing: resolveDungeonCardinalFacing(intent.facing) });
    });
    return () => { offAgent(); offSettings(); unbind(); keyboard.dispose(); };
  },
};
