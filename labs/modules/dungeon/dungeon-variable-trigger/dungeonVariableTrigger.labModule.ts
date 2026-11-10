import { collectDungeonVariableTriggers } from '@/core/dungeon-interaction/dungeonVariableTriggers';
import { matchesVariableCondition } from '@/core/entity/components/variable-trigger.component';
import { DUNGEON_RUNTIME_ASSEMBLY_SERVICE_KEY } from '@/core/dungeon-runtime/dungeonRuntimeAssembly';
import type { LabModule } from '@/labs/kit';
import { DUNGEON_INTERACTION_INPUTS } from '../dungeon-interaction/dungeonInteraction.labModule';
import { DUNGEON_MAP_ACTION_EXECUTOR, dungeonVariableChangedEvent } from '../dungeon-map-action-executor/dungeonMapActionExecutor.labModule';

export const dungeonVariableTriggerLabModule: LabModule = {
  id: 'dungeon-variable-trigger', dependencies: ['dungeon-interaction', 'dungeon-map-action-executor', 'dungeon-map-loader'],
  events: [{ definition: dungeonVariableChangedEvent }],
  setup(context) {
    const executor = context.services.get(DUNGEON_MAP_ACTION_EXECUTOR);
    const inputs = context.services.get(DUNGEON_INTERACTION_INPUTS);
    const assembly = context.services.get(DUNGEON_RUNTIME_ASSEMBLY_SERVICE_KEY);
    let active: { loadId: number; rules: ReturnType<typeof collectDungeonVariableTriggers>['rules'] } | undefined;
    const offPreparation = assembly.registerPreparation('dungeon-variable-trigger', runtime => {
      const { rules, issues } = collectDungeonVariableTriggers(runtime.map.document, true);
      if (issues.length) throw new Error(issues.map(issue => `${issue.path}: ${issue.message}`).join('\n'));
      return rules;
    }, (rules, loadId) => { active = { loadId, rules }; });
    const offChange = context.communication.on(dungeonVariableChangedEvent, async change => {
      const session = active;
      const trace = change.variableTrace ?? [];
      if (session?.loadId !== change.loadId || !inputs.enabled() || assembly.isPaused || context.scheduler.isPaused) return;
      const errors: unknown[] = [];
      for (const rule of session.rules) {
        if (active !== session || assembly.isPaused || context.scheduler.isPaused) break;
        if (rule.variableId !== change.variableId || rule.threshold === undefined || !rule.action
          || trace.includes(rule.id)
          || matchesVariableCondition(change.previous, rule.operator, rule.threshold)
          || !matchesVariableCondition(change.current, rule.operator, rule.threshold)) continue;
        if (trace.length >= 32) throw new Error('变量触发链超过 32 条规则。');
        try {
          await executor.execute(rule.action, { loadId: change.loadId, ruleId: rule.id, sourceEntityId: rule.entityId,
            actorId: change.actorId, variableTrace: [...trace, rule.id] });
        } catch (error) {
          errors.push(new Error(`规则 ${rule.id}：${error instanceof Error ? error.message : String(error)}`));
        }
      }
      if (errors.length) throw new AggregateError(errors, errors.map(String).join('\n'));
    });
    return () => { active = undefined; offChange(); offPreparation(); };
  },
};
