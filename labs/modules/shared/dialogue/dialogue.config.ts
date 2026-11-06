import type { LabConfig } from '@/labs/kit/config/LabConfig';

export type DialogueConfig = { preset: string; entry: string; 'ui-preset': string };
export function registerDialogueConfig(config?: LabConfig): DialogueConfig {
  const defaults: DialogueConfig = { preset: 'dialogue_test', entry: 'greeting', 'ui-preset': 'dialogue_test_ui' };
  const valid = (value: unknown) => typeof value === 'string' && !!value.trim() && value.length <= 256;
  return config ? config.register('dialogue', Object.fromEntries(Object.entries(defaults).map(([key, defaultValue]) => [key, { defaultValue, valid }]))) as DialogueConfig : defaults;
}
