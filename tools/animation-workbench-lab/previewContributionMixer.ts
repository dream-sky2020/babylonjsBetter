import { mixNumericContributions, type NumericContribution, type NumericContributionMix } from '../../core/animation/contribution/index.ts';
import type { SignalGraphEvaluation } from '../../core/animation/signal/index.ts';
import type { AnimationObjectRecord, PreviewSignalBinding, WorkbenchVec3 } from './animationWorkspace.ts';

const finite = (value: unknown, fallback: number) => typeof value === 'number' && Number.isFinite(value) ? value : fallback;
const component = (object: AnimationObjectRecord, path: string) => {
  const [group, axis] = path.split('.') as ['position' | 'rotation' | 'scaling', keyof WorkbenchVec3];
  return object[group]?.[axis];
};

export const previewTargetKey = (objectId: string, path: string) => `${objectId}:${path}`;

export const createPreviewContributionMix = (evaluation: SignalGraphEvaluation, bindings: readonly PreviewSignalBinding[], objects: readonly AnimationObjectRecord[]): NumericContributionMix => {
  const objectById = new Map(objects.map(object => [object.id, object]));
  const baseValues = new Map<string, number>();
  const contributions: NumericContribution[] = [];
  bindings.forEach(binding => {
    if (binding.adapterTypeId !== 'babylon.transform-component.number') return;
    const object = objectById.get(binding.objectId); if (!object) return;
    const path = String(binding.config.path ?? 'position.y'); const baseValue = component(object, path); if (typeof baseValue !== 'number') return;
    const targetKey = previewTargetKey(binding.objectId, path); baseValues.set(targetKey, baseValue);
    const rawValue = evaluation.outputs.get(binding.outputId); if (typeof rawValue !== 'number') return;
    const modulationId = typeof binding.config.modulationOutputId === 'string' ? binding.config.modulationOutputId : '';
    const modulationValue = modulationId ? evaluation.outputs.get(modulationId) : 1;
    const weight = finite(binding.config.weight, 1) * (typeof modulationValue === 'number' ? modulationValue : 0);
    const operation = binding.config.operation;
    contributions.push({
      id: binding.id, sourceId: binding.outputId, targetKey,
      value: rawValue * finite(binding.config.scale, 1) + finite(binding.config.offset, 0),
      weight, priority: finite(binding.config.priority, 0),
      blendMode: operation === 'override' || operation === 'multiply' ? operation : 'additive',
      enabled: binding.config.enabled !== false, solo: binding.config.solo === true,
    });
  });
  return mixNumericContributions(baseValues, contributions);
};
