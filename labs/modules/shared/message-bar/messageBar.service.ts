import { createServiceToken } from '@/core/system-runtime/ServiceToken';

export type LabMessage = {
  text: string;
  durationSeconds?: number;
  channel?: string;
};

export type LabMessageBar = {
  show(message: LabMessage): void;
  clear(channel?: string): void;
};

export const LAB_MESSAGE_BAR = createServiceToken<LabMessageBar>('lab.message-bar');
