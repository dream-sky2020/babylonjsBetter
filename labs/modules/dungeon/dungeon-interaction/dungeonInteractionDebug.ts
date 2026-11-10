import { Color3, Matrix, Mesh, MeshBuilder, StandardMaterial, TransformNode, Vector3, type Scene } from '@babylonjs/core';
import type { InteractionDebugDescriptor } from '@/core/dungeon-interaction/dungeonInteraction.debug';
import { applyDungeonViewToNode, type ResolvedDungeonView } from '@/core/dungeon-view/dungeonOverheadView';
import { resolveDungeonMapTileWorldLayout } from '@/core/scene/dungeonMapSceneLayout';
import { resolveDungeonEdgeDebugLayout } from '../dungeon-obstacle/dungeonObstacleDebugLayout';
import type { DungeonGridData } from '../dungeon-grid/dungeonGrid.memory';

type Marker = { root: TransformNode; box: Mesh; label: HTMLDivElement; anchor: TransformNode;
  material: StandardMaterial; signature: string; showLabel: boolean; stackPixels: number; arrow: Mesh };
const prefix = 'dungeon_interaction_debug_';
const shortName = (name: string) => [...name].slice(0, 18).join('');
export type InteractionDebugOptions = {
  color: boolean; labels: boolean; name: boolean; trigger: boolean; action: boolean; state: boolean;
  direction?: boolean;
};
const defaultOptions: InteractionDebugOptions = { color: true, labels: true, name: true, trigger: true, action: false, state: true };
export function interactionDebugCaption(item: InteractionDebugDescriptor, key: string, consumed: boolean) {
  const trigger = item.triggers.map(value => value === 'interact' ? key.replace(/^Key/, '') : value === 'enter' ? '进入'
    : item.movementPhase === 'contact' ? '发现阻挡 · 接管' : item.movementPhase === 'blocked' ? '确认受阻 · 通知' : '移动受阻').join(' / ');
  const state = !item.enabled ? '已禁用' : consumed ? '本次已触发' : item.moving ? '移动中' : item.once ? '本次仅一次' : '可重复';
  const action = item.kind === 'transition' ? '传送' : item.kind === 'message' ? '地图提示'
    : item.kind === 'visual-state' ? '切换视觉状态' : item.kind === 'service' ? '触发服务' : item.targetRule === 'front' ? '面前对话' : '脚下对话';
  return { text: `${trigger} · ${action} · ${state}`, state, trigger, action,
    compact: `${trigger} · ${state === '本次已触发' ? '已触发' : state === '本次仅一次' ? '仅一次' : state === '已禁用' ? '禁用' : state}`,
    color: !item.enabled || consumed ? '#64748b' : item.kind === 'transition' ? '#a78bfa' : item.triggers.includes('enter') ? '#f59e0b' : '#38bdf8' };
}

/** Owns disposable display objects only. No collision, picking or interaction writes. */
export function createDungeonInteractionDebug(scene: Scene, labelHost: HTMLElement) {
  let root: TransformNode | null = null, loadId = 0, view: ResolvedDungeonView | null = null;
  const markers = new Map<string, Marker>();
  const remove = (id: string) => {
    const marker = markers.get(id); if (!marker) return;
    marker.label.remove(); marker.root.dispose(false, false); marker.material.dispose(); markers.delete(id);
  };
  const clear = () => { [...markers.keys()].forEach(remove); root?.dispose(); root = null; loadId = 0; };
  // Project world anchors every rendered frame; browser text retains its native
  // pixel size and antialiasing instead of being resampled as a mesh texture.
  const projection = scene.onAfterRenderObservable.add(() => {
    const camera = scene.activeCamera, canvas = scene.getEngine().getRenderingCanvas();
    if (!camera || !canvas || !markers.size) return;
    const engine = scene.getEngine(), canvasRect = canvas.getBoundingClientRect(), hostRect = labelHost.getBoundingClientRect();
    const width = engine.getRenderWidth(), height = engine.getRenderHeight();
    if (!width || !height) return;
    const viewport = camera.viewport.toGlobal(width, height);
    for (const marker of markers.values()) {
      if (!marker.showLabel) { marker.label.hidden = true; continue; }
      marker.anchor.computeWorldMatrix(true);
      const position = Vector3.Project(marker.anchor.getAbsolutePosition(), Matrix.IdentityReadOnly, scene.getTransformMatrix(), viewport);
      marker.label.hidden = position.z < 0 || position.z > 1 || !Number.isFinite(position.x + position.y);
      const x = canvasRect.left - hostRect.left + position.x * canvasRect.width / width;
      const y = canvasRect.top - hostRect.top + position.y * canvasRect.height / height - marker.stackPixels;
      marker.label.style.left = `${Math.round(x)}px`; marker.label.style.top = `${Math.round(y)}px`;
    }
  });
  return {
    clear,
    dispose() { scene.onAfterRenderObservable.remove(projection); clear(); },
    setView(next: ResolvedDungeonView | null) { view = next; if (root) applyDungeonViewToNode(root, view); },
    sync(items: readonly InteractionDebugDescriptor[], grid: DungeonGridData, key: string, isConsumed: (componentId: string) => boolean,
      options: InteractionDebugOptions = defaultOptions) {
      if (grid.loadId !== loadId) { clear(); loadId = grid.loadId; }
      if (!root) { root = new TransformNode(`${prefix}${loadId}`, scene); applyDungeonViewToNode(root, view); }
      const retained = new Set<string>(), slots = new Map<string, number>();
      const captions: string[] = [];
      for (const item of items) {
        retained.add(item.id);
        const tile = resolveDungeonMapTileWorldLayout(grid, grid.width, grid.height, item.placement.tileX, item.placement.tileY);
        const shortSide = Math.min(tile.size[0], tile.size[2]);
        const edge = item.placement.kind !== 'tile' && item.placement.direction ? resolveDungeonEdgeDebugLayout(grid, grid.width, grid.height,
          item.placement.tileX, item.placement.tileY, item.placement.direction, item.placement.kind === 'side') : null;
        const height = Math.max(.06, tile.size[1] * .2);
        const size: [number, number, number] = edge ? [edge.size[0], height, edge.size[2]]
          : [tile.size[0] * (item.tracksBody ? .46 : .88), height, tile.size[2] * (item.tracksBody ? .46 : .88)];
        let marker = markers.get(item.id);
        if (!marker) {
          const node = new TransformNode(`${prefix}entity_${item.id}`, scene); node.parent = root;
          const material = new StandardMaterial(`${prefix}fill_${item.id}`, scene); material.disableLighting = true; material.alpha = .15;
          const box = MeshBuilder.CreateBox(`${prefix}box_${item.id}`, { width: 1, height: 1, depth: 1 }, scene);
          box.parent = node; box.material = material; box.isPickable = false; box.enableEdgesRendering(); box.edgesWidth = 2;
          const anchor = new TransformNode(`${prefix}label_anchor_${item.id}`, scene); anchor.parent = node;
          const label = document.createElement('div'); label.dataset.interactionDebugLabel = item.id;
          Object.assign(label.style, { position: 'absolute', transform: 'translate(-50%, -50%)', pointerEvents: 'none',
            padding: '4px 7px', border: '1px solid', borderRadius: '3px', background: 'rgba(7, 18, 30, .9)',
            font: '400 13px/18px "Microsoft YaHei", sans-serif', textAlign: 'center', whiteSpace: 'nowrap', maxWidth: '220px' });
          labelHost.append(label);
          const arrow = MeshBuilder.CreateLines(`${prefix}facing_${item.id}`, { points: [
            new Vector3(0, .02, 0), new Vector3(0, .02, -shortSide * .48),
            new Vector3(-shortSide * .09, .02, -shortSide * .34), new Vector3(0, .02, -shortSide * .48),
            new Vector3(shortSide * .09, .02, -shortSide * .34),
          ] }, scene); arrow.color = Color3.White(); arrow.parent = node; arrow.isPickable = false;
          marker = { root: node, box, label, anchor, material, arrow, signature: '', showLabel: false, stackPixels: 0 }; markers.set(item.id, marker);
        }
        const center = tile.center;
        marker.root.position.set(edge?.center[0] ?? center[0], center[1] + tile.size[1] / 2 + height, edge?.center[2] ?? center[2]);
        marker.box.scaling.set(...size);
        const consumed = isConsumed(item.onceKey ?? item.componentId), caption = interactionDebugCaption(item, key, consumed);
        const lines: string[] = [];
        if (options.name) lines.push(item.ruleName ?? item.label.split(' · ')[0]);
        const detail = [options.trigger ? caption.trigger : '', options.state ? caption.state : ''].filter(Boolean).join(' · ');
        if (detail) lines.push(detail);
        if (options.action) lines.push(caption.action);
        if (options.direction && item.directionText) lines.push(item.directionText);
        const compass = ['north', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west', 'north-west'];
        const facing = item.facing ? compass.indexOf(item.facing) : -1;
        marker.arrow.setEnabled(!!options.direction && facing >= 0 && !slots.has(`facing:${item.entityId}`));
        if (facing >= 0) { marker.arrow.rotation.y = -facing * Math.PI / 4; slots.set(`facing:${item.entityId}`, 1); }
        marker.box.setEnabled(options.color);
        marker.showLabel = options.labels && lines.length > 0;
        marker.label.hidden = !marker.showLabel;
        marker.anchor.position.set(0, shortSide * (.36 + (item.tracksBody ? .32 : 0)), 0);
        captions.push(`${shortName(item.label)}${item.ruleName ? ` · ${item.ruleName}` : ''}：${caption.text}${item.directionText ? ` · ${item.directionText}` : ''}`);
        const signature = JSON.stringify([lines, caption.color, options.name]);
        if (signature !== marker.signature) {
          marker.signature = signature;
          const color = Color3.FromHexString(caption.color); marker.material.emissiveColor = color; marker.box.edgesColor.set(color.r, color.g, color.b, .95);
          marker.label.style.borderColor = caption.color; marker.label.title = `${item.label}：${caption.text}`;
          marker.label.replaceChildren();
          lines.forEach((line, index) => {
            const row = document.createElement('div'); row.textContent = line;
            const isName = options.name && index === 0;
            Object.assign(row.style, { color: isName ? '#ffffff' : caption.color, fontWeight: isName ? '600' : '400',
              overflow: 'hidden', textOverflow: 'ellipsis' });
            marker!.label.append(row);
          });
        }
        const slotKey = `${item.placement.tileX}:${item.placement.tileY}:${item.placement.direction ?? ''}`;
        marker.stackPixels = slots.get(slotKey) ?? 0;
        if (marker.showLabel) slots.set(slotKey, marker.stackPixels + marker.label.offsetHeight + 4);
        marker.root.metadata = { interactionDebug: true, entityId: item.entityId, componentId: item.componentId, state: caption.state, consumed, loadId };
      }
      for (const id of markers.keys()) if (!retained.has(id)) remove(id);
      return captions;
    },
  };
}
