import type { SpecialStatus3dValues,SpecialStatus3dVisibility,SpecialStatusVisualPresetMap } from '@/core/special-status';
import type { ExclamationBasePresetMap,ExclamationMarkPresetMap,NumberSpritePresetMap,SpriteVisualSurfaceFactory } from '@/core/sprite';
import type { Color3,Vector3 } from '@babylonjs/core';
import type { Monster } from '../data';
import type { MonsterSpecialStatusRowAnchorMode } from '../special-status/monsterSpecialStatusPosition.types';
import type { MonsterDisplayConfigLibrary,MonsterStripePresetLibrary,StripePresetLibrary } from '../types/monster.types';
export type VisualMonster = Pick<Monster, 'id' | 'position' | 'chaos'> & {
    /** Optional identity metadata; rendering only requires the display configuration key. */
    typeId?: string;
    monsterConfigKey: string;
    monsterStripePresetKey: string;
};
export type VisualBattlefield = {
    id: string;
    name: string;
    width: number;
    cellSize: number;
    rowSpacing: number;
    monsters: VisualMonster[];
};
export type MonsterVisualResources = {
    configs: MonsterDisplayConfigLibrary;
    monsterStripes: MonsterStripePresetLibrary;
    stripes: StripePresetLibrary;
};
export type MonsterSpecialStatusVisualItem = {
    id: string;
    presetKey: string;
    statusId: string;
    values: SpecialStatus3dValues;
    visible: SpecialStatus3dVisibility;
};
export type MonsterSpecialStatusVisualResources = {
    visualPresets: SpecialStatusVisualPresetMap;
    numberPresets: NumberSpritePresetMap;
};
export type MonsterSpecialStatusVisualLayout = {
    spacing: [
        number,
        number,
        number
    ];
    groupOffset: [
        number,
        number,
        number
    ];
    groupScale: number;
    wrapCount: number;
    rowAnchorMode: MonsterSpecialStatusRowAnchorMode;
    billboard: boolean;
    debugVisible: boolean;
    facingAxis: '+Z' | '-Z';
};
export type MonsterExclamationVisualResources = {
    markPresets: ExclamationMarkPresetMap;
    basePresets: ExclamationBasePresetMap;
};
export type MonsterHitVisualParameters = {
    durationMs: number;
    shakeAmplitude: number;
    shakeFrequency: number;
    overlayStrength: number;
    color: Color3;
};
export type MonsterVisualOptions = {
    spriteSurfaceFactory?: SpriteVisualSurfaceFactory;
};
export type MonsterVisualChannel = 'movement' | 'attack' | 'hit' | 'death';
export type MonsterVisualFrame = {
    anchorPosition?: Vector3;
    visualOffset?: Vector3;
    rotationX?: number;
    rotationY?: number;
    rotationZ?: number;
    scaleX?: number;
    scaleY?: number;
    scaleZ?: number;
    overlayColor?: Color3;
    overlayStrength?: number;
    opacity?: number;
    layers?: Array<{
        offsetX?: number;
        offsetY?: number;
        opacity?: number;
    }>;
};
export type MonsterVisualCapability = {
    update?(dt: number): void;
    clear(): void;
    dispose(): void;
};
