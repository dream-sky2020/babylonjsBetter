import type { LabConfig, ConfigField } from '../../../kit/config/LabConfig';

export type PlayerMovementConfig = {
  bounds: boolean; obstacles: boolean; teleport: boolean; 'debug-marker': boolean;
  'keyboard-enabled': boolean; 'continuous-movement': boolean; 'eight-way': boolean;
  'hold-multiplier': number; 'hold-offset': number; 'keyboard-priority': number;
  'keyboard-intercept': boolean; 'keyboard-prevent-default': boolean;
  'movement-timing-mode': 'world-units-per-second' | 'seconds-per-tile';
  'movement-timing-values': { 'world-units-per-second': string; 'seconds-per-tile': string };
  'swap-duration': number; 'swap-ignore-presentation': boolean;
  'turn-timing-mode': 'radians-per-second' | 'seconds-per-turn';
  'turn-timing-values': { 'radians-per-second': string; 'seconds-per-turn': string };
};
const boolean = (defaultValue: boolean): ConfigField => ({ defaultValue, valid: value => typeof value === 'boolean' });
const number = (defaultValue: number, minimum = -Infinity): ConfigField => ({ defaultValue,
  valid: value => typeof value === 'number' && Number.isFinite(value) && value >= minimum });
const positiveStrings = (defaults: Record<string, string>): ConfigField => ({ defaultValue: defaults,
  valid: value => !!value && typeof value === 'object' && !Array.isArray(value)
    && Object.keys(defaults).every(key => typeof (value as Record<string, unknown>)[key] === 'string'
      && Number.isFinite(Number((value as Record<string, unknown>)[key])) && Number((value as Record<string, unknown>)[key]) > 0) });
export const playerMovementConfigFields: Record<keyof PlayerMovementConfig, ConfigField> = {
  bounds: boolean(true), obstacles: boolean(true), teleport: boolean(false), 'debug-marker': boolean(true),
  'keyboard-enabled': boolean(true), 'continuous-movement': boolean(true), 'eight-way': boolean(false),
  'hold-multiplier': number(.8, 0), 'hold-offset': number(0), 'keyboard-priority': number(75),
  'keyboard-intercept': boolean(true), 'keyboard-prevent-default': boolean(true),
  'movement-timing-mode': { defaultValue: 'world-units-per-second', valid: value => ['world-units-per-second', 'seconds-per-tile'].includes(value as string) },
  'movement-timing-values': positiveStrings({ 'world-units-per-second': '60', 'seconds-per-tile': '1' }),
  'swap-duration': number(0, 0), 'swap-ignore-presentation': boolean(false),
  'turn-timing-mode': { defaultValue: 'radians-per-second', valid: value => ['radians-per-second', 'seconds-per-turn'].includes(value as string) },
  'turn-timing-values': positiveStrings({ 'radians-per-second': '360', 'seconds-per-turn': '.25' }),
};
export function createPlayerMovementConfig(config?: LabConfig): PlayerMovementConfig {
  return (config ? config.register('player-movement', playerMovementConfigFields)
    : Object.fromEntries(Object.entries(playerMovementConfigFields).map(([key, field]) => [key, structuredClone(field.defaultValue)]))) as PlayerMovementConfig;
}
/** Shared by panel-equipped Labs and runtime-only consumers. Angles in the file are degrees. */
export function playerMovementTiming(config: PlayerMovementConfig) {
  const mode = config['movement-timing-mode'], turn = config['turn-timing-mode'];
  return {
    movementTimingMode: mode,
    movementSpeed: mode === 'world-units-per-second' ? Number(config['movement-timing-values'][mode]) : undefined,
    movementSecondsPerTile: mode === 'seconds-per-tile' ? Number(config['movement-timing-values'][mode]) : undefined,
    turnTimingMode: turn,
    turnSpeed: turn === 'radians-per-second' ? Number(config['turn-timing-values'][turn]) * Math.PI / 180 : undefined,
    turnSecondsPerAction: turn === 'seconds-per-turn' ? Number(config['turn-timing-values'][turn]) : undefined,
  };
}
