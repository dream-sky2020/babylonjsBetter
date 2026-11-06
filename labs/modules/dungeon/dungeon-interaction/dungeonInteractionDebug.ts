import { Color3, DynamicTexture, Mesh, MeshBuilder, StandardMaterial, TransformNode, Vector3, type Scene } from '@babylonjs/core';
import type { InteractionDebugDescriptor } from '@/core/dungeon-interaction/dungeonInteraction.debug';
import { applyDungeonViewToNode, type ResolvedDungeonView } from '@/core/dungeon-view/dungeonOverheadView';
import { resolveDungeonMapTileWorldLayout } from '@/core/scene/dungeonMapSceneLayout';
import { resolveDungeonEdgeDebugLayout } from '../dungeon-obstacle/dungeonObstacleDebugLayout';
import type { DungeonGridData } from '../dungeon-grid/dungeonGrid.memory';

type Marker = { root: TransformNode; box: Mesh; label: Mesh; material: StandardMaterial; labelMaterial: StandardMaterial;
  texture: DynamicTexture; signature: string };
const prefix = 'dungeon_interaction_debug_';
const shortName = (name: string) => [...name].slice(0, 18).join('');
export function interactionDebugCaption(item: InteractionDebugDescriptor, key: string, consumed: boolean) {
  const trigger = item.triggers.map(value => value === 'interact' ? key.replace(/^Key/, '') : value === 'enter' ? '进入' : '撞边').join(' / ');
  const state = !item.enabled ? '已禁用' : consumed ? '本次已触发' : item.moving ? '移动中' : item.once ? '本次仅一次' : '可重复';
  const action = item.kind === 'transition' ? '传送' : item.targetRule === 'front' ? '面前对话' : '脚下对话';
  return { text: `${trigger} · ${action} · ${state}`, state,
    compact: `${trigger} · ${state === '本次已触发' ? '已触发' : state === '本次仅一次' ? '仅一次' : state === '已禁用' ? '禁用' : state}`,
    color: !item.enabled || consumed ? '#64748b' : item.kind === 'transition' ? '#a78bfa' : item.triggers.includes('enter') ? '#f59e0b' : '#38bdf8' };
}

/** Owns disposable display objects only. No collision, picking or interaction writes. */
export function createDungeonInteractionDebug(scene: Scene) {
  let root: TransformNode | null = null, loadId = 0, view: ResolvedDungeonView | null = null;
  const markers = new Map<string, Marker>();
  const remove = (id: string) => {
    const marker = markers.get(id); if (!marker) return;
    marker.root.dispose(false, false); marker.material.dispose(); marker.labelMaterial.dispose(); marker.texture.dispose(); markers.delete(id);
  };
  const clear = () => { [...markers.keys()].forEach(remove); root?.dispose(); root = null; loadId = 0; };
  return {
    clear,
    setView(next: ResolvedDungeonView | null) { view = next; if (root) applyDungeonViewToNode(root, view); },
    sync(items: readonly InteractionDebugDescriptor[], grid: DungeonGridData, key: string, isConsumed: (componentId: string) => boolean) {
      if (grid.loadId !== loadId) { clear(); loadId = grid.loadId; }
      if (!root) { root = new TransformNode(`${prefix}${loadId}`, scene); applyDungeonViewToNode(root, view); }
      const retained = new Set<string>(), slots = new Map<string, number>();
      const screenUp = scene.activeCamera?.getDirection(Vector3.Up()).normalize() ?? Vector3.Up();
      const captions: string[] = [];
      for (const item of items) {
        retained.add(item.id);
        const tile = resolveDungeonMapTileWorldLayout(grid, grid.width, grid.height, item.placement.tileX, item.placement.tileY);
        const shortSide = Math.min(tile.size[0], tile.size[2]);
        const edge = item.placement.kind !== 'tile' && item.placement.direction ? resolveDungeonEdgeDebugLayout(grid, grid.width, grid.height,
          item.placement.tileX, item.placement.tileY, item.placement.direction, item.placement.kind === 'side') : null;
        const height = Math.max(.06, tile.size[1] * .2);
        const size: [number, number, number] = edge ? [edge.size[0], height, edge.size[2]]
          : [tile.size[0] * (item.worldPosition ? .46 : .88), height, tile.size[2] * (item.worldPosition ? .46 : .88)];
        let marker = markers.get(item.id);
        if (!marker) {
          const node = new TransformNode(`${prefix}entity_${item.id}`, scene); node.parent = root;
          const material = new StandardMaterial(`${prefix}fill_${item.id}`, scene); material.disableLighting = true; material.alpha = .15;
          const box = MeshBuilder.CreateBox(`${prefix}box_${item.id}`, { width: 1, height: 1, depth: 1 }, scene);
          box.parent = node; box.material = material; box.isPickable = false; box.enableEdgesRendering(); box.edgesWidth = 2;
          const texture = new DynamicTexture(`${prefix}text_${item.id}`, { width: 512, height: 192 }, scene, false); texture.hasAlpha = true;
          const labelMaterial = new StandardMaterial(`${prefix}label_material_${item.id}`, scene);
          labelMaterial.diffuseTexture = texture; labelMaterial.useAlphaFromDiffuseTexture = true; labelMaterial.disableLighting = true;
          labelMaterial.emissiveColor = Color3.White(); labelMaterial.backFaceCulling = false; labelMaterial.disableDepthWrite = true;
          const label = MeshBuilder.CreatePlane(`${prefix}label_${item.id}`, { width: shortSide * 1.02, height: shortSide * .3825 }, scene);
          label.parent = node; label.material = labelMaterial; label.billboardMode = Mesh.BILLBOARDMODE_ALL; label.isPickable = false;
          label.renderingGroupId = 2;
          marker = { root: node, box, label, material, labelMaterial, texture, signature: '' }; markers.set(item.id, marker);
        }
        const center = item.worldPosition ?? tile.center;
        marker.root.position.set(edge?.center[0] ?? center[0], center[1] + tile.size[1] / 2 + height, edge?.center[2] ?? center[2]);
        marker.box.scaling.set(...size);
        const slotKey = `${item.placement.tileX}:${item.placement.tileY}:${item.placement.direction ?? ''}`;
        const slot = slots.get(slotKey) ?? 0; slots.set(slotKey, slot + 1);
        const lift = slot * shortSide * .62;
        marker.label.position.set(screenUp.x * lift / root.scaling.x,
          shortSide * (.36 + (item.worldPosition ? .32 : 0)) + screenUp.y * lift, screenUp.z * lift / root.scaling.z);
        const consumed = isConsumed(item.componentId), caption = interactionDebugCaption(item, key, consumed);
        captions.push(`${shortName(item.label)}：${caption.text}`);
        const signature = `${item.label}:${caption.text}:${caption.color}`;
        if (signature !== marker.signature) {
          marker.signature = signature;
          const color = Color3.FromHexString(caption.color); marker.material.emissiveColor = color; marker.box.edgesColor.set(color.r, color.g, color.b, .95);
          const canvas = marker.texture.getContext() as CanvasRenderingContext2D; canvas.clearRect(0, 0, 512, 192); canvas.fillStyle = 'rgba(7, 18, 30, .9)'; canvas.fillRect(0, 0, 512, 192);
          canvas.strokeStyle = caption.color; canvas.lineWidth = 5; canvas.strokeRect(3, 3, 506, 186);
          canvas.textAlign = 'center'; canvas.textBaseline = 'middle'; canvas.fillStyle = '#ffffff'; canvas.font = 'bold 60px "Microsoft YaHei", sans-serif';
          const name = item.kind === 'transition' ? '传送出口' : item.label.split(' · ')[0];
          canvas.fillText([...name].slice(0, 8).join(''), 256, 57, 484); canvas.fillStyle = caption.color; canvas.font = '60px "Microsoft YaHei", sans-serif'; canvas.fillText(caption.compact, 256, 140, 484);
          marker.texture.update();
        }
        marker.root.metadata = { interactionDebug: true, entityId: item.entityId, componentId: item.componentId, state: caption.state, consumed, loadId };
      }
      for (const id of markers.keys()) if (!retained.has(id)) remove(id);
      return captions;
    },
  };
}
