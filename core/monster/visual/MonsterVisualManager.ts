import { Color3, MeshBuilder, StandardMaterial, TransformNode, Vector3, type Mesh, type Scene } from '@babylonjs/core';
import type {
  StripeLayerProgressOptions,
  StripeProgressMaskOptions
} from '@/core/sprite/render/createSpriteEffectMaterial.ts';
import {
  createLayeredMonster,
  MONSTER_RENDER_ORDER,
  type LayeredMonsterController,
  type MonsterDisplayConfigLibrary,
  type MonsterStripePresetLibrary,
  type StripePresetLibrary
} from '@/core/monster';
import type { Monster } from '@/core/monster/data';
import { getMonsterMotionDefinition, type MonsterMotionParameterValues, type MonsterMotionPreset } from '@/core/monster-motion';
import { getMonsterAttackDefinition, type MonsterAttackParameterValues, type MonsterAttackPreset } from '@/core/monster-attack-motion';
import {
  createSpecialStatus3d,
  type SpecialStatus3dConfig,
  type SpecialStatus3dController,
  type SpecialStatus3dValues,
  type SpecialStatus3dVisibility,
  type SpecialStatusVisualPresetMap
} from '@/core/special-status';
import type { NumberSpritePresetMap } from '@/core/sprite';
import type { MonsterSpecialStatusRowAnchorMode } from '@/core/monster/special-status/monsterSpecialStatusPosition.types.ts';

export type VisualMonster = Monster & {
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
  spacing: [number, number, number];
  groupOffset: [number, number, number];
  groupScale: number;
  wrapCount: number;
  rowAnchorMode: MonsterSpecialStatusRowAnchorMode;
  billboard: boolean;
  debugVisible: boolean;
  facingAxis: '+Z' | '-Z';
};

type MonsterVisualEntry = {
  controller: LayeredMonsterController;
  anchor: TransformNode;
  marker: Mesh;
  basePosition: Vector3;
  baseScaling: Vector3;
  baseRotation: Vector3;
  displayConfig: MonsterDisplayConfigLibrary[string];
  stripePresetKey: string;
  stripePreset: MonsterStripePresetLibrary[string] | null;
  stripeLibrary: StripePresetLibrary;
  markerWidth: number;
};

type MonsterSpecialStatusVisualEntry = {
  controller: SpecialStatus3dController;
  configSignature: string;
  stateSignature: string;
};

type SpecialStatusPreviewEntry = MonsterSpecialStatusVisualEntry & {
  generation: number;
};

type ActiveMonsterMotion = {
  from: Vector3;
  to: Vector3;
  elapsed: number;
  duration: number;
  parameters: MonsterMotionParameterValues;
  definition: ReturnType<typeof getMonsterMotionDefinition>;
  onComplete?: () => void;
};

type ActiveMonsterAttack = {
  elapsed: number;
  duration: number;
  direction: Vector3;
  parameters: MonsterAttackParameterValues;
  definition: ReturnType<typeof getMonsterAttackDefinition>;
  onComplete?: () => void;
};

export type MonsterHitVisualParameters = {
  durationMs: number;
  shakeAmplitude: number;
  shakeFrequency: number;
  overlayStrength: number;
  color: Color3;
};

type ActiveMonsterHit = {
  elapsedMs: number;
  parameters: MonsterHitVisualParameters;
  onComplete?: () => void;
};

const HIT_LAYER_SHAKE_PROFILES = {
  bottomFillMask: { amplitude: 0.42, phase: 0.15, vertical: 0.1 },
  bottomBorder: { amplitude: 0.68, phase: 1.35, vertical: 0.14 },
  body: { amplitude: 1, phase: 2.6, vertical: 0.18 },
  line: { amplitude: 1.28, phase: 4.05, vertical: 0.22 }
} as const;

export type MonsterDistanceStripeRule = {
  id: string;
  /** 从第几行开始生效，使用从 1 开始的行号。 */
  startRow: number;
  monsterStripePresetKey: string;
};

export type BattlefieldDistanceStripeRuleConfig = {
  battlefieldId: string;
  name: string;
  rules: MonsterDistanceStripeRule[];
};

export type BattlefieldDistanceStripeRuleLibrary = Record<string, BattlefieldDistanceStripeRuleConfig>;

export const normalizeDistanceStripeRuleConfig = (
  battlefieldId: string,
  value?: Partial<BattlefieldDistanceStripeRuleConfig>
): BattlefieldDistanceStripeRuleConfig => ({
  battlefieldId,
  name: typeof value?.name === 'string' && value.name.trim() ? value.name : `${battlefieldId} 条纹距离规则`,
  rules: Array.isArray(value?.rules)
    ? value.rules.map((rule, index) => ({
      id: typeof rule.id === 'string' && rule.id.trim() ? rule.id : `rule_${index + 1}`,
      startRow: Math.max(1, Math.round(Number(rule.startRow) || index + 1)),
      monsterStripePresetKey: typeof rule.monsterStripePresetKey === 'string' ? rule.monsterStripePresetKey : ''
    })).sort((a, b) => a.startRow - b.startRow)
    : []
});

export const resolveDistanceStripePresetKey = (
  rules: readonly MonsterDistanceStripeRule[],
  row: number,
  fallback: string
): string => {
  const rowNumber = row + 1;
  let match = fallback;
  for (const rule of [...rules].sort((a, b) => a.startRow - b.startRow)) {
    if (rowNumber >= rule.startRow && rule.monsterStripePresetKey) match = rule.monsterStripePresetKey;
  }
  return match;
};

export const calculateMonsterWorldPosition = (
  battlefield: VisualBattlefield,
  monster: VisualMonster
) => ({
  x: monster.position.isOccupyingFullRowCentered
    ? 0
    : (monster.position.column + monster.position.size / 2 - battlefield.width / 2) * battlefield.cellSize,
  z: -monster.position.row * battlefield.rowSpacing
});

/** 只负责把编队数据同步为 Babylon 视觉对象，不修改战场数据。 */
export class MonsterVisualManager {
  private readonly scene: Scene;
  private readonly monsters = new Map<string, MonsterVisualEntry>();
  private readonly motions = new Map<string, ActiveMonsterMotion>();
  private readonly attacks = new Map<string, ActiveMonsterAttack>();
  private readonly hits = new Map<string, ActiveMonsterHit>();
  private readonly specialStatuses = new Map<string, Map<string, MonsterSpecialStatusVisualEntry>>();
  private readonly specialStatusGenerations = new Map<string, number>();
  private readonly specialStatusPreviews = new Map<string, SpecialStatusPreviewEntry>();
  private readonly specialStatusPreviewGenerations = new Map<string, number>();
  private readonly distanceStripeRules = new Map<string, BattlefieldDistanceStripeRuleConfig>();
  private readonly root: TransformNode;
  private readonly gridRoot: TransformNode;
  private lastResources: MonsterVisualResources | null = null;
  private gridSignature = '';
  private helpersVisible = true;
  private time = 0;

  constructor(scene: Scene) {
    this.scene = scene;
    this.root = new TransformNode('monsterFormationVisuals', scene);
    this.gridRoot = new TransformNode('monsterFormationGrid', scene);
  }

  setHelpersVisible(visible: boolean): void {
    this.helpersVisible = visible;
    this.gridRoot.setEnabled(visible);
    this.monsters.forEach(({ marker }) => marker.setEnabled(visible));
  }

  setDistanceStripeRules(config: BattlefieldDistanceStripeRuleConfig): void {
    this.distanceStripeRules.set(config.battlefieldId, normalizeDistanceStripeRuleConfig(config.battlefieldId, config));
  }

  setDistanceStripeRuleLibrary(library: BattlefieldDistanceStripeRuleLibrary): void {
    this.distanceStripeRules.clear();
    Object.entries(library).forEach(([battlefieldId, config]) => {
      this.setDistanceStripeRules({ ...config, battlefieldId });
    });
  }

  getDistanceStripeRules(battlefieldId: string): BattlefieldDistanceStripeRuleConfig | undefined {
    const config = this.distanceStripeRules.get(battlefieldId);
    return config ? normalizeDistanceStripeRuleConfig(battlefieldId, config) : undefined;
  }

  exportDistanceStripeRuleLibrary(): BattlefieldDistanceStripeRuleLibrary {
    return Object.fromEntries(
      [...this.distanceStripeRules].map(([battlefieldId, config]) => [
        battlefieldId,
        normalizeDistanceStripeRuleConfig(battlefieldId, config)
      ])
    );
  }

  resolveMonsterStripePresetKey(battlefield: VisualBattlefield, monster: VisualMonster, fallback: string): string {
    const rules = this.distanceStripeRules.get(battlefield.id)?.rules ?? [];
    return resolveDistanceStripePresetKey(rules, monster.position.row, fallback);
  }

  sync(
    battlefield: VisualBattlefield,
    resources: MonsterVisualResources,
    selectedId: string,
    distanceStripeRuleConfig?: BattlefieldDistanceStripeRuleConfig
  ): void {
    if (distanceStripeRuleConfig) this.setDistanceStripeRules(distanceStripeRuleConfig);
    this.lastResources = resources;
    const activeRules = this.distanceStripeRules.get(battlefield.id)?.rules ?? [];
    const rowCount = Math.max(1, ...battlefield.monsters.map(({ position }) => position.row + 1), ...activeRules.map((rule) => rule.startRow));
    this.syncGrid(battlefield, rowCount);

    const nextIds = new Set(battlefield.monsters.map((monster) => monster.id));
    for (const [monsterId, entry] of this.monsters) {
      if (nextIds.has(monsterId)) continue;
      this.disposeMonsterEntry(entry);
      this.monsters.delete(monsterId);
      this.motions.delete(monsterId);
      this.attacks.delete(monsterId);
      this.hits.delete(monsterId);
      this.clearMonsterSpecialStatuses(monsterId);
    }

    for (const item of battlefield.monsters) {
      const config = resources.configs[item.monsterConfigKey];
      const existing = this.monsters.get(item.id);
      if (!config) {
        if (existing) {
          this.disposeMonsterEntry(existing);
          this.monsters.delete(item.id);
          this.motions.delete(item.id);
          this.attacks.delete(item.id);
          this.hits.delete(item.id);
          this.clearMonsterSpecialStatuses(item.id);
        }
        continue;
      }
      const position = calculateMonsterWorldPosition(battlefield, item);
      const fallbackStripeKey = item.monsterStripePresetKey || config.monsterStripePresetKey;
      const effectiveStripeKey = this.resolveMonsterStripePresetKey(battlefield, item, fallbackStripeKey);
      const stripePreset = resources.monsterStripes[effectiveStripeKey] ?? null;
      const entry = existing ?? this.createMonsterEntry(item, battlefield, config, effectiveStripeKey, stripePreset, resources);

      if (entry.displayConfig !== config) {
        entry.controller.load(config, stripePreset, resources.stripes);
        entry.displayConfig = config;
        entry.basePosition.copyFrom(entry.controller.root.position);
        entry.baseScaling.copyFrom(entry.controller.root.scaling);
        entry.baseRotation.copyFrom(entry.controller.root.rotation);
        entry.controller.root.parent = entry.anchor;
      } else if (
        entry.stripePresetKey !== effectiveStripeKey ||
        entry.stripePreset !== stripePreset ||
        entry.stripeLibrary !== resources.stripes
      ) {
        entry.controller.setStripePreset(stripePreset, resources.stripes);
      }
      entry.stripePresetKey = effectiveStripeKey;
      entry.stripePreset = stripePreset;
      entry.stripeLibrary = resources.stripes;

      if (!this.motions.has(item.id) && !this.attacks.has(item.id)) {
        entry.anchor.position.set(position.x, 0, position.z);
        entry.marker.position.x = position.x;
        entry.marker.position.z = position.z;
      }
      this.updateMarker(entry, item, battlefield, selectedId);
      if (!existing) this.monsters.set(item.id, entry);
    }
  }

  private syncGrid(battlefield: VisualBattlefield, rowCount: number): void {
    const signature = `${battlefield.id}|${battlefield.width}|${battlefield.cellSize}|${battlefield.rowSpacing}|${rowCount}`;
    if (signature === this.gridSignature) return;
    this.gridRoot.getChildMeshes().forEach((mesh) => {
      mesh.material?.dispose();
      mesh.dispose();
    });
    this.gridSignature = signature;
    const material = new StandardMaterial(`placementGrid_${Date.now()}`, this.scene);
    material.diffuseColor = new Color3(0.12, 0.45, 0.68);
    material.emissiveColor = new Color3(0.03, 0.15, 0.24);
    material.alpha = 0.34;
    for (let row = 0; row < rowCount; row += 1) {
      for (let column = 0; column < battlefield.width; column += 1) {
        const cell = MeshBuilder.CreateBox(`cell_${row}_${column}`, {
          width: battlefield.cellSize - 0.08,
          depth: Math.min(battlefield.cellSize, battlefield.rowSpacing) - 0.08,
          height: 0.035
        }, this.scene);
        cell.position.set((column + 0.5 - battlefield.width / 2) * battlefield.cellSize, -2.105, -row * battlefield.rowSpacing);
        cell.material = material;
        cell.parent = this.gridRoot;
        cell.isPickable = false;
      }
    }
  }

  private createMonsterEntry(
    item: VisualMonster,
    battlefield: VisualBattlefield,
    config: MonsterDisplayConfigLibrary[string],
    stripePresetKey: string,
    stripePreset: MonsterStripePresetLibrary[string] | null,
    resources: MonsterVisualResources
  ): MonsterVisualEntry {
    const position = calculateMonsterWorldPosition(battlefield, item);
    const anchor = new TransformNode(`movementAnchor_${item.id}`, this.scene);
    anchor.parent = this.root;
    anchor.position.set(position.x, 0, position.z);
    const controller = createLayeredMonster(this.scene, `placement_${item.id}`);
    controller.load(config, stripePreset, resources.stripes);
    const basePosition = controller.root.position.clone();
    const baseScaling = controller.root.scaling.clone();
    const baseRotation = controller.root.rotation.clone();
    controller.root.parent = anchor;
    controller.root.position.copyFrom(basePosition);

    const markerWidth = this.calculateMarkerWidth(item, battlefield);
    const marker = MeshBuilder.CreateBox(`marker_${item.id}`, { width: markerWidth, depth: 0.14, height: 0.08 }, this.scene);
    marker.position.set(position.x, -2.03, position.z);
    const markerMaterial = new StandardMaterial(`markerMaterial_${item.id}`, this.scene);
    markerMaterial.alpha = 0.72;
    marker.material = markerMaterial;
    marker.parent = this.root;
    marker.isPickable = false;
    marker.setEnabled(this.helpersVisible);

    return {
      controller,
      anchor,
      marker,
      basePosition,
      baseScaling,
      baseRotation,
      displayConfig: config,
      stripePresetKey,
      stripePreset,
      stripeLibrary: resources.stripes,
      markerWidth
    };
  }

  private calculateMarkerWidth(item: VisualMonster, battlefield: VisualBattlefield): number {
    return item.position.isOccupyingFullRowCentered
      ? Math.max(0.2, battlefield.width * battlefield.cellSize - 0.12)
      : Math.max(0.2, item.position.size * battlefield.cellSize - 0.12);
  }

  private updateMarker(
    entry: MonsterVisualEntry,
    item: VisualMonster,
    battlefield: VisualBattlefield,
    selectedId: string
  ): void {
    const width = this.calculateMarkerWidth(item, battlefield);
    if (Math.abs(width - entry.markerWidth) > 0.0001) {
      entry.marker.scaling.x *= width / entry.markerWidth;
      entry.markerWidth = width;
    }
    const material = entry.marker.material as StandardMaterial | null;
    if (!material) return;
    material.diffuseColor = item.position.isOccupyingFullRowCentered
      ? new Color3(1, 0.42, 0.08)
      : item.id === selectedId ? new Color3(0.2, 1, 0.65) : new Color3(0.2, 0.65, 1);
    material.emissiveColor = material.diffuseColor.scale(0.5);
  }

  private disposeMonsterEntry(entry: MonsterVisualEntry): void {
    entry.marker.material?.dispose();
    entry.marker.dispose();
    entry.controller.dispose();
    entry.anchor.dispose();
  }

  moveMonster(
    battlefield: VisualBattlefield,
    monster: VisualMonster,
    preset: MonsterMotionPreset,
    onComplete?: () => void
  ): boolean {
    const entry = this.monsters.get(monster.id);
    const definition = getMonsterMotionDefinition(preset.modeId);
    if (!entry || !definition) return false;
    this.attacks.delete(monster.id);

    const target = calculateMonsterWorldPosition(battlefield, monster);
    const to = new Vector3(target.x, 0, target.z);
    const config = this.lastResources?.configs[monster.monsterConfigKey];
    if (config && this.lastResources) {
      const fallback = monster.monsterStripePresetKey || config.monsterStripePresetKey || '';
      const stripeKey = this.resolveMonsterStripePresetKey(battlefield, monster, fallback);
      entry.controller.setStripePreset(this.lastResources.monsterStripes[stripeKey] ?? null, this.lastResources.stripes);
    }
    this.motions.set(monster.id, {
      from: entry.anchor.position.clone(),
      to,
      elapsed: 0,
      duration: Math.max(0.05, Number(preset.parameters.duration) || 1),
      parameters: { ...preset.parameters },
      definition,
      onComplete
    });
    return true;
  }

  stopMonsterMovement(monsterId: string): void {
    this.motions.delete(monsterId);
  }

  stopAllMovements(): void {
    this.motions.clear();
  }

  playMonsterAttack(
    monsterId: string,
    preset: MonsterAttackPreset,
    direction: Vector3,
    onComplete?: () => void
  ): boolean {
    const entry = this.monsters.get(monsterId);
    const definition = getMonsterAttackDefinition(preset.modeId);
    if (!entry || !definition) return false;

    const normalizedDirection = direction.clone();
    normalizedDirection.y = 0;
    if (normalizedDirection.lengthSquared() < 0.000001) normalizedDirection.set(0, 0, 1);
    else normalizedDirection.normalize();
    this.motions.delete(monsterId);
    this.resetVisualTransform(entry);
    this.attacks.set(monsterId, {
      elapsed: 0,
      duration: Math.max(0.05, Number(preset.parameters.duration) || 1),
      direction: normalizedDirection,
      parameters: { ...preset.parameters },
      definition,
      onComplete
    });
    return true;
  }

  stopMonsterAttack(monsterId: string): void {
    const entry = this.monsters.get(monsterId);
    this.attacks.delete(monsterId);
    if (entry) this.resetVisualTransform(entry);
  }

  stopAllAttacks(): void {
    this.attacks.clear();
    this.monsters.forEach((entry) => this.resetVisualTransform(entry));
  }

  playMonsterHit(
    monsterId: string,
    parameters: MonsterHitVisualParameters,
    onComplete?: () => void
  ): boolean {
    const entry = this.monsters.get(monsterId);
    if (!entry) return false;
    this.clearHitVisual(entry);
    this.hits.set(monsterId, {
      elapsedMs: 0,
      parameters: {
        durationMs: Math.max(1, Number(parameters.durationMs) || 1),
        shakeAmplitude: Math.max(0, Number(parameters.shakeAmplitude) || 0),
        shakeFrequency: Math.max(0, Number(parameters.shakeFrequency) || 0),
        overlayStrength: Math.max(0, Math.min(1, Number(parameters.overlayStrength) || 0)),
        color: parameters.color.clone()
      },
      onComplete
    });
    return true;
  }

  stopMonsterHit(monsterId: string): void {
    const entry = this.monsters.get(monsterId);
    this.hits.delete(monsterId);
    if (entry) this.clearHitVisual(entry);
  }

  stopAllHits(): void {
    this.hits.clear();
    this.monsters.forEach((entry) => this.clearHitVisual(entry));
  }

  getMonsterWorldPosition(monsterId: string): Vector3 | null {
    return this.monsters.get(monsterId)?.anchor.getAbsolutePosition().clone() ?? null;
  }

  /** 怪物最终视觉根节点的世界坐标，包含显示配置和实例偏移。 */
  getMonsterVisualWorldPosition(monsterId: string): Vector3 | null {
    return this.monsters.get(monsterId)?.controller.root.getAbsolutePosition().clone() ?? null;
  }

  /** 设置单个怪物实例相对于战场格位的附加偏移。 */
  setMonsterInstanceOffset(monsterId: string, offset: Vector3): void {
    const entry = this.monsters.get(monsterId);
    if (!entry) return;
    entry.anchor.position.addInPlace(offset);
    entry.marker.position.addInPlace(offset);
  }

  /**
   * 将某个怪物当前的特殊状态数据同步为视觉对象。
   * 状态节点挂在怪物视觉根节点下，因此会自动跟随移动、攻击和受击动画。
   */
  async syncMonsterSpecialStatuses(
    monsterId: string,
    items: readonly MonsterSpecialStatusVisualItem[],
    resources: MonsterSpecialStatusVisualResources,
    layout: MonsterSpecialStatusVisualLayout
  ): Promise<void> {
    const monster = this.monsters.get(monsterId);
    if (!monster) {
      this.clearMonsterSpecialStatuses(monsterId);
      return;
    }

    const generation = (this.specialStatusGenerations.get(monsterId) ?? 0) + 1;
    this.specialStatusGenerations.set(monsterId, generation);
    const entries = this.specialStatuses.get(monsterId) ?? new Map<string, MonsterSpecialStatusVisualEntry>();
    this.specialStatuses.set(monsterId, entries);
    const nextIds = new Set(items.map((item) => item.id));
    for (const [statusVisualId, entry] of entries) {
      if (nextIds.has(statusVisualId)) continue;
      entry.controller.dispose();
      entries.delete(statusVisualId);
    }

    const columns = Math.max(1, Math.floor(layout.wrapCount));
    const rowCount = Math.max(1, Math.ceil(items.length / columns));
    for (const [itemIndex, item] of items.entries()) {
      if (this.specialStatusGenerations.get(monsterId) !== generation) return;
      const preset = resources.visualPresets[item.presetKey];
      const statusDefinition = preset?.statuses[item.statusId];
      const numberPreset = preset && resources.numberPresets[preset.babylon3d.numberPresetKey];
      if (!preset || !statusDefinition || !numberPreset) {
        const invalidEntry = entries.get(item.id);
        invalidEntry?.controller.dispose();
        entries.delete(item.id);
        continue;
      }

      const row = Math.floor(itemIndex / columns);
      const column = itemIndex % columns;
      const itemsInRow = Math.min(columns, items.length - row * columns);
      const centeredColumn = column - (itemsInRow - 1) / 2;
      const rowOffset = layout.rowAnchorMode === 'first-row-up'
        ? row
        : layout.rowAnchorMode === 'first-row-down'
          ? -row
          : row - (rowCount - 1) / 2;
      const visual = preset.babylon3d;
      const position: [number, number, number] = [
        visual.position[0] + layout.groupOffset[0] + layout.spacing[0] * centeredColumn,
        visual.position[1] + layout.groupOffset[1] + layout.spacing[1] * rowOffset,
        visual.position[2] + layout.groupOffset[2] + layout.spacing[2] * rowOffset
      ];
      const config: SpecialStatus3dConfig = {
        iconPath: statusDefinition.imagePath || '/resources/favicon.svg',
        numberPreset,
        statusHeight: visual.statusHeight,
        statusScale: visual.statusScale,
        numberScale: visual.numberScale,
        cornerInset: visual.cornerInset,
        position,
        numberOffsets: visual.numberOffsets.map((offset) => [...offset]) as SpecialStatus3dConfig['numberOffsets'],
        billboard: layout.billboard,
        facingAxis: layout.facingAxis
      };
      const configSignature = JSON.stringify([config, layout.groupScale, layout.debugVisible]);
      const stateSignature = JSON.stringify([item.values, item.visible]);
      let entry = entries.get(item.id);
      if (!entry) {
        const controller = await createSpecialStatus3d(this.scene, config, {
          values: item.values,
          visible: item.visible,
          debug: layout.debugVisible
        }, `monsterStatus_${monsterId}_${item.id}`);
        if (this.specialStatusGenerations.get(monsterId) !== generation || !this.monsters.has(monsterId)) {
          controller.dispose();
          return;
        }
        controller.root.parent = monster.controller.root;
        controller.root.scaling.setAll(Math.max(0.01, layout.groupScale));
        entry = { controller, configSignature, stateSignature };
        entries.set(item.id, entry);
        continue;
      }
      if (entry.configSignature !== configSignature) {
        await entry.controller.setConfig(config);
        if (this.specialStatusGenerations.get(monsterId) !== generation) return;
        entry.controller.root.scaling.setAll(Math.max(0.01, layout.groupScale));
        entry.controller.setDebugVisible(layout.debugVisible);
        entry.configSignature = configSignature;
      }
      if (entry.stateSignature !== stateSignature) {
        await entry.controller.setValues(item.values, item.visible);
        if (this.specialStatusGenerations.get(monsterId) !== generation) return;
        entry.stateSignature = stateSignature;
      }
    }
  }

  clearMonsterSpecialStatuses(monsterId: string): void {
    this.specialStatusGenerations.set(monsterId, (this.specialStatusGenerations.get(monsterId) ?? 0) + 1);
    const entries = this.specialStatuses.get(monsterId);
    entries?.forEach(({ controller }) => controller.dispose());
    this.specialStatuses.delete(monsterId);
  }

  clearAllMonsterSpecialStatuses(): void {
    for (const monsterId of [...this.specialStatuses.keys()]) this.clearMonsterSpecialStatuses(monsterId);
    this.specialStatusGenerations.clear();
  }

  /** 管理不依附怪物的单个特殊状态预览，供视觉配置场景复用正式渲染逻辑。 */
  async syncSpecialStatusPreview(
    previewId: string,
    config: SpecialStatus3dConfig,
    values: SpecialStatus3dValues,
    visible: SpecialStatus3dVisibility,
    debugVisible: boolean
  ): Promise<void> {
    const generation = (this.specialStatusPreviewGenerations.get(previewId) ?? 0) + 1;
    this.specialStatusPreviewGenerations.set(previewId, generation);
    const configSignature = JSON.stringify([config, debugVisible]);
    const stateSignature = JSON.stringify([values, visible]);
    let entry = this.specialStatusPreviews.get(previewId);
    if (!entry) {
      const controller = await createSpecialStatus3d(this.scene, config, {
        values,
        visible,
        debug: debugVisible
      }, `specialStatusPreview_${previewId}`);
      if (this.specialStatusPreviewGenerations.get(previewId) !== generation) {
        controller.dispose();
        return;
      }
      controller.root.parent = this.root;
      entry = { controller, configSignature, stateSignature, generation };
      this.specialStatusPreviews.set(previewId, entry);
      return;
    }
    entry.generation = generation;
    if (entry.configSignature !== configSignature) {
      await entry.controller.setConfig(config);
      if (this.specialStatusPreviewGenerations.get(previewId) !== generation) return;
      entry.controller.setDebugVisible(debugVisible);
      entry.configSignature = configSignature;
    }
    if (entry.stateSignature !== stateSignature) {
      await entry.controller.setValues(values, visible);
      if (this.specialStatusPreviewGenerations.get(previewId) !== generation) return;
      entry.stateSignature = stateSignature;
    }
  }

  clearSpecialStatusPreview(previewId: string): void {
    this.specialStatusPreviewGenerations.set(previewId, (this.specialStatusPreviewGenerations.get(previewId) ?? 0) + 1);
    this.specialStatusPreviews.get(previewId)?.controller.dispose();
    this.specialStatusPreviews.delete(previewId);
  }

  clearAllSpecialStatusPreviews(): void {
    for (const previewId of [...this.specialStatusPreviews.keys()]) this.clearSpecialStatusPreview(previewId);
    this.specialStatusPreviewGenerations.clear();
  }

  /** 为配置编辑器提供只读的图层网格，不转移怪物视觉对象的生命周期。 */
  getMonsterLayerMesh(monsterId: string, layerKey: (typeof MONSTER_RENDER_ORDER)[number]): Mesh | null {
    return this.monsters.get(monsterId)?.controller.getLayerMesh(layerKey) ?? null;
  }

  setMonsterFacingAxis(monsterId: string, axis: '+Z' | '-Z'): void {
    this.monsters.get(monsterId)?.controller.setFacingAxis(axis);
  }

  setMonsterTransform(monsterId: string, scale: number, height: number, offsetX: number): void {
    const entry = this.monsters.get(monsterId);
    if (!entry) return;
    entry.controller.setTransform(scale, height, offsetX);
    entry.basePosition.copyFrom(entry.controller.root.position);
    entry.baseScaling.copyFrom(entry.controller.root.scaling);
    entry.baseRotation.copyFrom(entry.controller.root.rotation);
  }

  setMonsterLayerProgress(
    monsterId: string,
    layerKey: (typeof MONSTER_RENDER_ORDER)[number],
    progress: StripeProgressMaskOptions,
    layerProgress: StripeLayerProgressOptions
  ): void {
    this.monsters.get(monsterId)?.controller.setLayerProgress(layerKey, progress, layerProgress);
  }

  private resetVisualTransform(entry: MonsterVisualEntry): void {
    entry.controller.root.position.copyFrom(entry.basePosition);
    entry.controller.root.scaling.copyFrom(entry.baseScaling);
    entry.controller.root.rotation.copyFrom(entry.baseRotation);
  }

  private clearHitVisual(entry: MonsterVisualEntry): void {
    entry.controller.clearLayerEffectOffsets();
    entry.controller.setColorOverlay(Color3.Red(), 0);
  }

  update(deltaTime: number): void {
    this.time += deltaTime;
    this.monsters.forEach(({ controller }) => controller.updateTime(this.time));
    for (const [id, active] of this.motions) {
      const entry = this.monsters.get(id);
      if (!entry || !active.definition) {
        this.motions.delete(id);
        continue;
      }
      active.elapsed += deltaTime;
      const progress = Math.min(1, active.elapsed / active.duration);
      const direction = active.to.subtract(active.from);
      direction.y = 0;
      const distance = direction.length();
      if (distance > 0) direction.scaleInPlace(1 / distance);
      const frame = active.definition.sample({ progress, from: active.from, to: active.to, direction, distance }, active.parameters);
      entry.anchor.position.copyFrom(frame.anchorPosition);
      entry.marker.position.x = frame.anchorPosition.x;
      entry.marker.position.z = frame.anchorPosition.z;
      entry.controller.root.position.copyFrom(entry.basePosition).addInPlace(frame.visualOffset);
      entry.controller.root.rotation.copyFrom(entry.baseRotation);
      entry.controller.root.rotation.z += frame.rotationZ;
      entry.controller.root.scaling.set(
        entry.baseScaling.x * frame.scaleX,
        entry.baseScaling.y * frame.scaleY,
        entry.baseScaling.z * frame.scaleZ
      );
      if (progress < 1) continue;
      entry.anchor.position.copyFrom(active.to);
      entry.controller.root.position.copyFrom(entry.basePosition);
      entry.controller.root.scaling.copyFrom(entry.baseScaling);
      entry.controller.root.rotation.copyFrom(entry.baseRotation);
      this.motions.delete(id);
      active.onComplete?.();
    }
    for (const [id, active] of this.attacks) {
      const entry = this.monsters.get(id);
      if (!entry || !active.definition) {
        this.attacks.delete(id);
        continue;
      }
      active.elapsed += deltaTime;
      const progress = Math.min(1, active.elapsed / active.duration);
      const frame = active.definition.sample({ progress, direction: active.direction }, active.parameters);
      entry.controller.root.position.copyFrom(entry.basePosition).addInPlace(frame.visualOffset);
      entry.controller.root.rotation.set(
        entry.baseRotation.x + frame.rotationX,
        entry.baseRotation.y + frame.rotationY,
        entry.baseRotation.z + frame.rotationZ
      );
      entry.controller.root.scaling.set(
        entry.baseScaling.x * frame.scaleX,
        entry.baseScaling.y * frame.scaleY,
        entry.baseScaling.z * frame.scaleZ
      );
      if (progress < 1) continue;
      this.resetVisualTransform(entry);
      this.attacks.delete(id);
      active.onComplete?.();
    }
    for (const [id, active] of this.hits) {
      const entry = this.monsters.get(id);
      if (!entry) {
        this.hits.delete(id);
        continue;
      }
      active.elapsedMs += deltaTime * 1000;
      const { parameters } = active;
      const progress = Math.max(0, Math.min(1, active.elapsedMs / parameters.durationMs));
      if (progress >= 1) {
        this.clearHitVisual(entry);
        this.hits.delete(id);
        active.onComplete?.();
        continue;
      }
      const envelope = Math.pow(1 - progress, 1.35);
      const phase = progress * parameters.durationMs / 1000 * parameters.shakeFrequency * Math.PI * 2;
      const flashEnvelope = progress < 0.18 ? 1 : Math.pow(1 - (progress - 0.18) / 0.82, 1.6);
      for (const layerKey of MONSTER_RENDER_ORDER) {
        const profile = HIT_LAYER_SHAKE_PROFILES[layerKey];
        const layerPhase = phase + profile.phase;
        entry.controller.setLayerEffectOffset(
          layerKey,
          Math.sin(layerPhase) * parameters.shakeAmplitude * profile.amplitude * envelope,
          Math.sin(layerPhase * 1.73 + 0.8) * parameters.shakeAmplitude * profile.vertical * envelope
        );
      }
      entry.controller.setColorOverlay(parameters.color, parameters.overlayStrength * flashEnvelope);
    }
  }

  clear(): void {
    this.motions.clear();
    this.attacks.clear();
    this.hits.clear();
    this.clearAllMonsterSpecialStatuses();
    this.clearAllSpecialStatusPreviews();
    this.monsters.forEach((entry) => this.disposeMonsterEntry(entry));
    this.monsters.clear();
    this.gridRoot.getChildMeshes().forEach((mesh) => {
      mesh.material?.dispose();
      mesh.dispose();
    });
    this.gridSignature = '';
  }

  dispose(): void {
    this.clear();
    this.gridRoot.dispose();
    this.root.dispose();
  }
}
