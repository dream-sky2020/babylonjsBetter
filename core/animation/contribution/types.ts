export type NumericContributionBlendMode = 'additive' | 'override' | 'multiply';

export type NumericContribution = Readonly<{
  id: string;
  sourceId: string;
  targetKey: string;
  value: number;
  weight: number;
  priority: number;
  blendMode: NumericContributionBlendMode;
  enabled: boolean;
  solo: boolean;
}>;

export type AppliedNumericContribution = NumericContribution & Readonly<{
  effectiveWeight: number;
  valueBefore: number;
  valueAfter: number;
  suppressed: boolean;
}>;

export type NumericContributionMix = Readonly<{
  values: ReadonlyMap<string, number>;
  groups: ReadonlyMap<string, readonly AppliedNumericContribution[]>;
  errors: readonly string[];
}>;
