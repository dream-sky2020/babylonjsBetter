import type { LabModule } from '../labKit.types';

export type LabExecutionPlanEntry = {
  readonly module: LabModule;
  readonly moduleId: string;
  readonly dependencies: readonly string[];
  readonly depth: number;
  readonly executionIndex: number;
  readonly requested: boolean;
};

export type LabExecutionPlan = {
  readonly entries: readonly LabExecutionPlanEntry[];
  readonly setupOrder: readonly LabModule[];
  readonly startOrder: readonly LabModule[];
  readonly disposeOrder: readonly LabModule[];
};

export type LabModuleExecutionStatus =
  | 'pending'
  | 'setting-up'
  | 'setup'
  | 'starting'
  | 'started'
  | 'disposing'
  | 'disposed'
  | 'failed';

export type LabModuleExecutionInspection = {
  readonly moduleId: string;
  readonly dependencies: readonly string[];
  readonly depth: number;
  readonly executionIndex: number;
  readonly requested: boolean;
  readonly status: LabModuleExecutionStatus;
  readonly setupDurationMs?: number;
  readonly startDurationMs?: number;
  readonly error?: string;
};

export type LabExecutionListener = () => void;
