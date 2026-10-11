import type { SceneEnvironmentInstance, SceneEnvironmentPreset } from './sceneEnvironment.types.ts';
import type { PreparedModelMaterials } from '../model/material/modelMaterialController.ts';
/** Returns false for structural edits. Prepare every changed entity before touching the scene. */
export function isModelMaterialOnlyChange(previous: SceneEnvironmentPreset, next: SceneEnvironmentPreset): boolean {
  const structure = (p: SceneEnvironmentPreset) => JSON.stringify({ ...p, models: p.models.map(({ materialOverrides: _overrides, ...model }) => model) });
  return structure(previous) === structure(next);
}
export async function updateSceneModelMaterials(instance: SceneEnvironmentInstance, previous: SceneEnvironmentPreset, next: SceneEnvironmentPreset, signal: AbortSignal): Promise<boolean> {
  if (!isModelMaterialOnlyChange(previous,next)) return false;
  const targets = next.models.filter((m,i) => JSON.stringify(m.materialOverrides) !== JSON.stringify(previous.models[i].materialOverrides));
  const prepared: PreparedModelMaterials[] = [];
  try {
    // Sequential preparation is intentional: failures leave no unobserved pending acquisitions.
    for (const model of targets) {
      signal.throwIfAborted();
      const entry = instance.models.find(item => item.definition.id === model.id);
      if (!entry) throw new Error(`模型实例不存在：${model.id}`);
      prepared.push(await entry.entity.prepareMaterialBindings(model.materialOverrides,signal));
    }
    signal.throwIfAborted(); prepared.forEach(p => p.validate());
    try { prepared.forEach(p => p.commit()); }
    catch (error) {
      const failures: unknown[] = [error];
      for (const transaction of [...prepared].reverse()) {
        try { transaction.rollback(); } catch (rollbackError) { failures.push(rollbackError); }
      }
      throw failures.length === 1 ? error : new AggregateError(failures, '批量材质提交及回滚失败');
    }
    prepared.forEach(p => p.finalize()); return true;
  } finally { prepared.forEach(p => p.dispose()); }
}
