import { TransformNode, type Scene } from '@babylonjs/core';
import { createLayeredMonster, type LayeredMonsterController } from '@/core/monster/render/createLayeredMonster';
import { MONSTER_LAYER_KEYS } from '@/core/monster/config/monsterConfig';
import type { MonsterLayerKey } from '@/core/monster/types/monster.types';
import type { MonsterVisualResources } from '@/core/monster/visual/monsterVisual.types';
import { writeTransform } from '@/core/scene-editor/transform';
import type { LabObject, LabObjectEditing, LabObjectHistory } from '@/labs/kit/objects/LabObjects';
import { MONSTER_LAYER_LABELS, type MonsterVisualObject, type MonsterVisualObjectsDraft } from './monsterVisualObjects.model';
import type { MonsterVisualObjectTarget } from './monsterVisualObjects.service';

type Handle = { root: TransformNode; visual: LayeredMonsterController; signature: string; records: LabObject[]; generation: number; revision: number; hidden: Set<MonsterLayerKey>; target: MonsterVisualObjectTarget };
/** Authoring objects only: no battlefield, action runtime or formation coordinates. */
export class MonsterVisualObjects {
  private handles = new Map<string, Handle>();
  private scene: Scene;
  private draft: MonsterVisualObjectsDraft;
  private resources: MonsterVisualResources;
  private history: LabObjectHistory;
  private inspector: (id: string, layer?: MonsterLayerKey) => LabObject['mountInspector'];
  constructor(scene: Scene, draft: MonsterVisualObjectsDraft, resources: MonsterVisualResources,
    history: LabObjectHistory, inspector: (id: string, layer?: MonsterLayerKey) => LabObject['mountInspector']) {
    this.scene = scene; this.draft = draft; this.resources = resources; this.history = history; this.inspector = inspector;
  }
  objects = (): LabObject[] => [...this.handles.values()].flatMap(handle => handle.records);
  roots = () => [...this.handles.values()].map(handle => handle.root);
  target = (id: string): MonsterVisualObjectTarget | null => this.handles.get(id)?.target ?? null;
  private object(id: string) { return this.draft.value.objects.find(object => object.id === id)!; }
  private binding(id: string, target: TransformNode, layer?: MonsterLayerKey): LabObjectEditing {
    return { target, channels: ['position', 'rotation', 'scaling'], spaces: ['local', 'world'], minScale: .001, history: this.history,
      sync: () => { const object = this.object(id); if (object && !target.isDisposed()) writeTransform(target, layer ? object.layers[layer].transform : object.transform); },
      commit: (_edit, value) => this.draft.update(id, object => { if (layer) object.layers[layer].transform = structuredClone(value); else object.transform = structuredClone(value); }),
    };
  }
  sync() {
    const ids = new Set(this.draft.value.objects.map(object => object.id));
    for (const [id, handle] of this.handles) if (!ids.has(id)) { handle.visual.dispose(); handle.root.dispose(); this.handles.delete(id); }
    for (const object of this.draft.value.objects) {
      let handle = this.handles.get(object.id);
      if (!handle) {
        const root = new TransformNode(`monsterVisualObject:${object.id}`, this.scene);
        root.metadata = { monsterVisualObjectId: object.id };
        const visual = createLayeredMonster(this.scene, `monsterVisualObject:${object.id}`, { layerParents: true, deformation: false }); visual.root.parent = root;
        for (const key of MONSTER_LAYER_KEYS) visual.getLayerNode(key)!.metadata = { monsterVisualObjectId: object.id, monsterVisualLayer: key };
        const created: Handle = { root, visual, signature: '', records: [], generation: -1, revision: 0, hidden: new Set(),
          target: { root, get revision() { return created.revision; }, getLayerMesh: key => visual.getLayerMesh(key),
            setLayerDissolve: (key, options) => { if (!root.isDisposed()) visual.setLayerDissolve(key, options); },
            setLayerOpacity: (key, opacity) => { if (!root.isDisposed()) visual.setLayerOpacity(key, opacity); },
          } };
        handle = created; this.handles.set(object.id, handle);
      }
      if (handle.generation !== this.draft.generation) {
        const { root, visual } = handle; handle.generation = this.draft.generation; handle.revision++;
        handle.records = [{ id: object.id, name: object.name, node: root, kind: '怪物视觉对象', edit: this.binding(object.id, root), mountInspector: this.inspector(object.id),
          setVisible: visible => this.draft.update(object.id, value => { value.visible = visible; }) },
          ...MONSTER_LAYER_KEYS.map(key => ({ id: `${object.id}/${key}`, parentId: object.id, name: MONSTER_LAYER_LABELS[key], node: visual.getLayerNode(key)!, kind: '精灵图层',
            edit: this.binding(object.id, visual.getLayerNode(key)!, key), mountInspector: this.inspector(object.id, key),
            setVisible: (visible: boolean) => this.draft.update(object.id, value => { value.layers[key].visible = visible; }) }))];
      }
      const signature = JSON.stringify(object.config);
      if (signature !== handle.signature) {
        const stripeKey = object.config.monsterStripePresetKey;
        const style = stripeKey ? this.resources.monsterStripes[stripeKey] : null;
        // The document owns visibility; a visual style supplies materials only.
        const materialStyle = style ? { ...style, layers: Object.fromEntries(MONSTER_LAYER_KEYS.map(key => [key, { ...style.layers[key], visible: true }])) as typeof style.layers } : null;
        handle.visual.load(object.config, materialStyle, this.resources.stripes);
        handle.signature = signature;
        handle.revision++;
        for (const key of MONSTER_LAYER_KEYS) { const mesh = handle.visual.getLayerMesh(key); if (mesh) mesh.isPickable = true; }
      }
      handle.root.name = object.name; handle.records[0]!.name = object.name;
      handle.root.setEnabled(object.visible);
      writeTransform(handle.root, object.transform);
      this.syncLayers(handle, object);
    }
  }
  private syncLayers(handle: Handle, object: MonsterVisualObject) {
    for (const key of MONSTER_LAYER_KEYS) {
      const node = handle.visual.getLayerNode(key)!; writeTransform(node, object.layers[key].transform);
      node.setEnabled(object.layers[key].visible && !handle.hidden.has(key));
    }
  }
  update(time: number) { for (const handle of this.handles.values()) handle.visual.updateTime(time); }
  dispose() { for (const handle of this.handles.values()) { handle.visual.dispose(); handle.root.dispose(); } this.handles.clear(); }
}
