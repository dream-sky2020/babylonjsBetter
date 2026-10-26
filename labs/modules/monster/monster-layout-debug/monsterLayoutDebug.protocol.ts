import { createLabRequest } from '@/labs/kit/labCommunication.types';
export const monsterLayoutSettingsCommand = createLabRequest<{ visible: boolean }, void>('monster.layout.settings');
