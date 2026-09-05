import { createLabEvent } from '../labCommunication.types.ts';
import type { LabKeyboardConsumerSnapshot } from './labKeyboard.types.ts';

export const labKeyboardGlobalEnabledChangedEvent = createLabEvent<Readonly<{
  enabled: boolean;
}>>('lab.keyboard.global-enabled-changed');

export const labKeyboardConsumerSettingsChangedEvent = createLabEvent<Readonly<{
  consumer: LabKeyboardConsumerSnapshot;
}>>('lab.keyboard.consumer-settings-changed');

export const labKeyboardConflictDetectedEvent = createLabEvent<Readonly<{
  code: string;
  consumerIds: readonly string[];
}>>('lab.keyboard.conflict-detected');
