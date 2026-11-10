import { collectDungeonSharedVariables } from '@/core/dungeon-interaction/dungeonSharedVariables';
import type { DungeonMapDocumentV2 } from '@/core/map-document';
import { isSharedVariableValueOfType, validateSharedVariableOperation, type ISharedVariableComponent, type SharedVariableAction, type SharedVariableValue } from '@/core/entity/components/shared-variable.component';
import { defineLabMemoryType, defineLabSharedData, type LabMemoryScope, type LabSharedData } from '@/labs/kit/shared-memory/LabMemory';

const types = {
  integer: defineLabMemoryType('dungeon.variable.integer', (value): value is SharedVariableValue => isSharedVariableValueOfType('integer', value)),
  boolean: defineLabMemoryType('dungeon.variable.boolean', (value): value is SharedVariableValue => isSharedVariableValueOfType('boolean', value)),
  string: defineLabMemoryType('dungeon.variable.string', (value): value is SharedVariableValue => isSharedVariableValueOfType('string', value)),
};
type Variable = { declaration: ISharedVariableComponent; handle: LabSharedData<SharedVariableValue> };

export function createDungeonSharedVariableRuntime(memory: LabMemoryScope) {
  const allocated = new Map<string, Variable>();
  let current = new Map<string, Variable>();
  let currentLoadId = 0;
  return {
    prepare(document: DungeonMapDocumentV2) {
      const { definitions, issues } = collectDungeonSharedVariables(document);
      if (issues.length) throw new Error(issues.map(issue => `${issue.path}: ${issue.message}`).join('\n'));
      const prepared = [...definitions.values()].map(declaration => ({
        declaration,
        key: declaration.scope === 'map'
          ? `dungeon.variable.map.${encodeURIComponent(document.identity.id)}.${declaration.variableId}`
          : `dungeon.variable.lab.${declaration.variableId}`,
      }));
      for (const { key, declaration } of prepared) {
        const existing = allocated.get(key);
        if (existing && existing.declaration.valueType !== declaration.valueType) {
          throw new Error(`共享变量「${declaration.variableId}」已申请为 ${existing.declaration.valueType}，当前地图声明为 ${declaration.valueType}。`);
        }
      }
      return prepared;
    },
    commit(prepared: { key: string; declaration: ISharedVariableComponent }[], loadId: number) {
      const next = new Map<string, Variable>();
      for (const { key, declaration } of prepared) {
        let variable = allocated.get(key);
        if (!variable) {
          const handle = memory.acquire(defineLabSharedData({
            key, label: declaration.label ?? declaration.variableId, type: types[declaration.valueType],
            create: () => declaration.initialValue, inspect: value => value,
          }));
          variable = { declaration, handle };
          allocated.set(key, variable);
        }
        next.set(declaration.variableId, variable);
      }
      current = next;
      currentLoadId = loadId;
    },
    execute(loadId: number, action: SharedVariableAction) {
      const variable = currentLoadId === loadId ? current.get(action.variableId) : undefined;
      if (!variable) throw new Error(`当前地图没有共享变量「${action.variableId}」。`);
      const { declaration, handle } = variable;
      const error = validateSharedVariableOperation(action, declaration.valueType);
      if (error) throw new Error(error);
      let value = action.value;
      switch (action.variableOperation ?? 'set') {
        case 'add': value = Number(handle.current) + Number(action.value); break;
        case 'toggle': value = !handle.current; break;
        case 'reset': value = declaration.initialValue; break;
      }
      if (!isSharedVariableValueOfType(declaration.valueType, value)) throw new Error(`共享变量「${action.variableId}」的操作结果超出类型范围。`);
      const previous = handle.current;
      if (Object.is(previous, value)) return;
      handle.replace(value);
      return { previous, current: value };
    },
  };
}
