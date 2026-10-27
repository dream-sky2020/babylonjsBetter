import type { MonsterDisplayConfig, MonsterLayerKey } from '@/core/monster/types/monster.types';
import { MONSTER_LAYER_KEYS } from '@/core/monster/config/monsterConfig.ts';
import { DocumentHistory } from '@/core/scene-editor/DocumentHistory.ts';
import type { EditorTransform } from '@/core/scene-editor/types';

export type MonsterVisualObject = {
  id: string; name: string; visible: boolean; configKey: string; config: MonsterDisplayConfig;
  transform: EditorTransform;
  layers: Record<MonsterLayerKey, { transform: EditorTransform; visible: boolean }>;
};
export type MonsterVisualDocument = { format: 'monster-visual-objects'; version: 1; objects: MonsterVisualObject[] };
export const identityTransform = (): EditorTransform => ({ position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 }, scaling: { x: 1, y: 1, z: 1 } });
export const emptyMonsterVisualDocument = (): MonsterVisualDocument => ({ format: 'monster-visual-objects', version: 1, objects: [] });
export const MONSTER_LAYER_LABELS: Record<MonsterLayerKey, string> = { bottomFillMask: '底部填充', bottomBorder: '底部边框', body: '身体', line: '线稿' };
export function createMonsterVisualObject(configKey: string, config: MonsterDisplayConfig, id: string): MonsterVisualObject {
  return { id, name: config.name, visible: true, configKey, config: structuredClone(config), transform: identityTransform(),
    layers: Object.fromEntries(MONSTER_LAYER_KEYS.map(key => [key, { transform: identityTransform(), visible: true }])) as MonsterVisualObject['layers'] };
}
const record = (value: unknown): value is Record<string, any> => !!value && typeof value === 'object' && !Array.isArray(value);
const finite = (value: unknown) => typeof value === 'number' && Number.isFinite(value) && Math.abs(value) <= 1e9;
function validTransform(value: unknown): value is EditorTransform {
  return record(value) && ['position', 'rotation', 'scaling'].every(channel => record(value[channel])
    && ['x', 'y', 'z'].every(axis => finite(value[channel][axis]) && (channel !== 'scaling' || value[channel][axis] >= .001)));
}
/** Reject malformed documents before replacing any live objects. Resource paths may be empty to omit a layer. */
export function validateMonsterVisualDocument(value: unknown): MonsterVisualDocument {
  if (!record(value) || value.format !== 'monster-visual-objects' || value.version !== 1 || !Array.isArray(value.objects) || value.objects.length > 1000)
    throw new Error('怪物视觉对象文档格式或版本无效。');
  const ids = new Set<string>();
  for (const object of value.objects) {
    const config = object?.config;
    if (!record(object) || typeof object.id !== 'string' || !/^[a-zA-Z0-9_.-]+$/.test(object.id) || ids.has(object.id)
      || typeof object.name !== 'string' || typeof object.visible !== 'boolean' || typeof object.configKey !== 'string' || !validTransform(object.transform)
      || !record(config) || typeof config.id !== 'string' || typeof config.name !== 'string'
      || !finite(config.scaleSize) || config.scaleSize < 1 || !finite(config.scene3dScale) || config.scene3dScale < .01
      || !finite(config.scene3dHeight) || !finite(config.scene3dOffsetX) || !['+Z', '-Z'].includes(config.spriteFacingAxis)
      || typeof config.monsterStripePresetKey !== 'string' || !Array.isArray(config.renderOrder)
      || config.renderOrder.join() !== MONSTER_LAYER_KEYS.join() || !record(config.layers) || !record(object.layers)
      || !MONSTER_LAYER_KEYS.every(key => record(config.layers[key]) && typeof config.layers[key].path === 'string'
        && record(object.layers[key]) && typeof object.layers[key].visible === 'boolean' && validTransform(object.layers[key].transform)))
      throw new Error('怪物视觉对象、图层或变换数据无效。');
    ids.add(object.id);
  }
  return structuredClone(value) as MonsterVisualDocument;
}
export class MonsterVisualObjectsDraft {
  history: DocumentHistory<MonsterVisualDocument>;
  generation = 0;
  private saved: string;
  private changed: () => void;
  constructor(value: MonsterVisualDocument, changed: () => void) {
    this.changed = changed;
    const document = validateMonsterVisualDocument(value); this.saved = JSON.stringify(document);
    this.history = new DocumentHistory(document, changed);
  }
  get value() { return this.history.value; }
  get dirty() { return JSON.stringify(this.value) !== this.saved; }
  markSaved() { this.saved = JSON.stringify(this.value); this.changed(); }
  replace(value: unknown, saved = false) {
    const document = validateMonsterVisualDocument(value);
    this.generation++;
    this.history = new DocumentHistory(document, this.changed);
    if (saved) this.saved = JSON.stringify(document);
    this.changed();
  }
  update(id: string, change: (object: MonsterVisualObject) => void) {
    const document = structuredClone(this.value), object = document.objects.find(item => item.id === id);
    if (!object) throw new Error('怪物视觉对象已移除。');
    change(object); this.history.set(validateMonsterVisualDocument(document));
  }
}
