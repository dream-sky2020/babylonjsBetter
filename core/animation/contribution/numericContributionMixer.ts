import type { AppliedNumericContribution, NumericContribution, NumericContributionMix } from './types.ts';

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

export const mixNumericContributions = (baseValues: ReadonlyMap<string, number>, contributions: readonly NumericContribution[]): NumericContributionMix => {
  const values = new Map(baseValues);
  const groups = new Map<string, AppliedNumericContribution[]>();
  const errors: string[] = [];
  const targetKeys = new Set([...baseValues.keys(), ...contributions.map(contribution => contribution.targetKey)]);

  targetKeys.forEach(targetKey => {
    const candidates = contributions.filter(contribution => contribution.targetKey === targetKey && contribution.enabled);
    const soloActive = candidates.some(contribution => contribution.solo);
    const sorted = [...candidates].sort((left, right) => left.priority - right.priority || left.id.localeCompare(right.id));
    let current = baseValues.get(targetKey) ?? 0;
    const applied: AppliedNumericContribution[] = [];

    sorted.forEach(contribution => {
      const suppressed = soloActive && !contribution.solo;
      const weight = Number.isFinite(contribution.weight) ? clamp01(contribution.weight) : 0;
      const validValue = Number.isFinite(contribution.value);
      if (!validValue) errors.push(`Contribution ${contribution.id} 的数值无效`);
      const effectiveWeight = suppressed || !validValue ? 0 : weight;
      const valueBefore = current;
      if (contribution.blendMode === 'additive') current += contribution.value * effectiveWeight;
      else if (contribution.blendMode === 'multiply') current *= 1 + (contribution.value - 1) * effectiveWeight;
      else current += (contribution.value - current) * effectiveWeight;
      applied.push({ ...contribution, effectiveWeight, valueBefore, valueAfter: current, suppressed });
    });
    values.set(targetKey, current); groups.set(targetKey, applied);
  });
  return { values, groups, errors };
};
