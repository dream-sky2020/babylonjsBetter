import type { LabModuleCatalog } from '../labKit.types';
import type { LabExecutionPlan, LabExecutionPlanEntry } from './labExecutionPlan.types';

const validateModule = (catalogKey: string, catalog: LabModuleCatalog) => {
  const module = catalog[catalogKey];
  if (!module) throw new Error(`找不到 Lab 模块“${catalogKey}”。`);
  if (module.id !== catalogKey) {
    throw new Error(`Lab Catalog Key“${catalogKey}”与模块 ID“${module.id}”不一致。`);
  }
  const dependencies = module.dependencies ?? [];
  const duplicate = dependencies.find((id, index) => dependencies.indexOf(id) !== index);
  if (duplicate) throw new Error(`Lab 模块“${module.id}”重复声明依赖“${duplicate}”。`);
  return module;
};

export const resolveLabExecutionPlan = (
  requestedModuleIds: readonly string[],
  catalog: LabModuleCatalog,
): LabExecutionPlan => {
  const requested = new Set(requestedModuleIds);
  const orderedIds: string[] = [];
  const complete = new Set<string>();
  const visiting = new Set<string>();
  const stack: string[] = [];
  const depths = new Map<string, number>();
  const discoveryOrder = new Map<string, number>();

  const visit = (id: string): number => {
    if (complete.has(id)) return depths.get(id)!;
    if (visiting.has(id)) {
      const cycleStart = stack.indexOf(id);
      const cycle = [...stack.slice(cycleStart), id];
      throw new Error(`Lab 模块存在循环依赖：“${cycle.join(' → ')}”。`);
    }
    const module = validateModule(id, catalog);
    if (!discoveryOrder.has(id)) discoveryOrder.set(id, discoveryOrder.size);
    visiting.add(id);
    stack.push(id);
    const dependencyDepths = (module.dependencies ?? []).map(visit);
    stack.pop();
    visiting.delete(id);
    const depth = dependencyDepths.length ? Math.max(...dependencyDepths) + 1 : 0;
    depths.set(id, depth);
    complete.add(id);
    orderedIds.push(id);
    return depth;
  };

  requestedModuleIds.forEach(visit);
  orderedIds.sort((left, right) => (
    depths.get(left)! - depths.get(right)!
    || discoveryOrder.get(left)! - discoveryOrder.get(right)!
    || left.localeCompare(right)
  ));
  const entries: LabExecutionPlanEntry[] = orderedIds.map((moduleId, executionIndex) => {
    const module = catalog[moduleId]!;
    return Object.freeze({
      module,
      moduleId,
      dependencies: Object.freeze([...(module.dependencies ?? [])]),
      depth: depths.get(moduleId)!,
      executionIndex,
      requested: requested.has(moduleId),
    });
  });
  const order = Object.freeze(entries.map(({ module }) => module));
  return Object.freeze({
    entries: Object.freeze(entries),
    setupOrder: order,
    startOrder: order,
    disposeOrder: Object.freeze([...order].reverse()),
  });
};
