import type { DungeonMapDocumentComponent, DungeonMapDocumentV2, DungeonMapSpatialAttachmentComponent, DungeonMapSpatialTarget } from '../map-document/dungeonMapDocument.types.ts';
import { validateSpatialBody, type ISpatialBodyComponent } from '../entity/components/spatial-body.component.ts';
import { validateSpatialCollider, type ISpatialColliderComponent } from '../entity/components/spatial-collider.component.ts';
import { validateSpatialInteraction, type ISpatialInteractionComponent } from '../entity/components/spatial-interaction.component.ts';

export type SpatialDefinitionIssue = { path: string; message: string };
export type SpatialBodyDefinition = {
  id: string;
  entityId: string;
  anchor: Exclude<DungeonMapSpatialTarget, { kind: 'map' }>;
  initial: ISpatialBodyComponent;
  colliders: ISpatialColliderComponent[];
  interaction?: ISpatialInteractionComponent;
};

/** Component identity is the stable body/collider identity; array order is never an ID. */
export function compileSpatialDefinitions(document: DungeonMapDocumentV2): {
  bodies: SpatialBodyDefinition[]; issues: SpatialDefinitionIssue[];
} {
  const issues: SpatialDefinitionIssue[] = [];
  const bodies: SpatialBodyDefinition[] = [];
  const add = (path: string, message: string) => issues.push({ path, message });
  const attachments = new Map<string, DungeonMapSpatialAttachmentComponent[]>();
  const colliders = new Map<string, ISpatialColliderComponent[]>();
  const interactions = new Map<string, ISpatialInteractionComponent>();
  const entityIds = new Set(document.entities.map(entity => entity.id));
  const legacyOwners = new Set([...(document.components['movement-obstacle'] ?? []), ...(document.components['grid-agent'] ?? [])].map(row => row.entityId));
  const targets = {
    tile: new Set(document.grid.tileIds), side: new Set(document.grid.sides.map(row => row.id)),
    edge: new Set(document.grid.edges.map(row => row.id)), point: new Set(document.grid.points.map(row => row.id)),
  };
  for (const row of document.components['spatial-attachment'] ?? []) {
    if (row.enabled === false) continue;
    const list = attachments.get(row.entityId) ?? [];
    list.push(row as DungeonMapSpatialAttachmentComponent); attachments.set(row.entityId, list);
  }
  const seenIds = new Set<string>();
  for (const rows of Object.values(document.components)) for (const row of rows) {
    if (seenIds.has(row.id)) add(`components.${row.type}.${row.id}`, '组件 ID 重复。');
    seenIds.add(row.id);
  }
  for (const row of document.components['spatial-collider'] ?? []) {
    const path = `components.spatial-collider.${row.id}`;
    validateSpatialCollider(row as DungeonMapDocumentComponent & ISpatialColliderComponent).forEach(message => add(path, message));
    const list = colliders.get(row.entityId) ?? [];
    list.push(row as DungeonMapDocumentComponent & ISpatialColliderComponent); colliders.set(row.entityId, list);
  }
  const owners = new Set<string>();
  for (const row of document.components['spatial-interaction'] ?? []) {
    const path = `components.spatial-interaction.${row.id}`;
    validateSpatialInteraction(row as DungeonMapDocumentComponent & ISpatialInteractionComponent).forEach(message => add(path, message));
    if (interactions.has(row.entityId)) add(path, '每个 Entity 只能有一个空间交互组件。');
    interactions.set(row.entityId, row as DungeonMapDocumentComponent & ISpatialInteractionComponent);
  }
  for (const row of document.components['spatial-body'] ?? []) {
    const path = `components.spatial-body.${row.id}`;
    validateSpatialBody(row as DungeonMapDocumentComponent & ISpatialBodyComponent).forEach(message => add(path, message));
    if (!entityIds.has(row.entityId)) add(path, 'Body 引用了不存在的 Entity。');
    if (owners.has(row.entityId)) add(path, '每个 Entity 只能有一个 Body。');
    owners.add(row.entityId);
    if (legacyOwners.has(row.entityId)) {
      add(path, 'Body 不能与旧空间组件并存。');
    }
    const owned = attachments.get(row.entityId) ?? [];
    const anchor = owned[0]?.targets?.[0];
    if (owned.length !== 1 || owned[0]?.targets?.length !== 1 || !anchor || anchor.kind === 'map') {
      add(path, 'Body 必须有唯一 Tile/Side/Edge/Point 挂载；多挂载不能隐式生成物体。');
      continue;
    }
    const targetId = anchor.kind === 'tile' ? anchor.tileId : anchor.kind === 'side' ? anchor.sideId : anchor.kind === 'edge' ? anchor.edgeId : anchor.pointId;
    if (!targets[anchor.kind]?.has(targetId)) add(path, 'Body 挂载目标不存在。');
    if (row.mobility === 'movable' && anchor.kind !== 'tile') add(path, '可移动物体必须挂载 Tile。');
    const shapes = colliders.get(row.entityId) ?? [];
    for (const shape of shapes) {
      const expected = anchor.kind === 'point' ? ['point'] : anchor.kind === 'tile' ? ['box', 'disc'] : ['boundary'];
      if (!expected.includes(shape.shape)) add(`components.spatial-collider.${shape.id}`, `形状与 ${anchor.kind} 挂载不兼容。`);
    }
    const interaction = interactions.get(row.entityId);
    if (interaction?.enabled !== false && interaction && interaction.onPlayerPush !== 'block') {
      const interactionPath = `components.spatial-interaction.${interaction.id}`;
      if (row.mobility !== 'movable') add(interactionPath, '推动或换位响应需要可移动 Body。');
      if (interaction.onPlayerPush === 'push' && row.pushable !== true) add(interactionPath, '推动响应需要在空间物体组件中开启“允许推动”。');
    }
    bodies.push({ id: row.id, entityId: row.entityId, anchor: structuredClone(anchor), initial: structuredClone(row) as DungeonMapDocumentComponent & ISpatialBodyComponent,
      colliders: structuredClone(shapes), ...(interaction ? { interaction: structuredClone(interaction) } : {}) });
  }
  for (const [entityId, shapes] of colliders) {
    if (!owners.has(entityId)) for (const shape of shapes) add(`components.spatial-collider.${shape.id}`, 'Collider 缺少所属 Body。');
  }
  for (const [entityId, interaction] of interactions) {
    if (!owners.has(entityId)) add(`components.spatial-interaction.${interaction.id}`, '空间交互组件缺少所属 Body。');
  }
  // Never expose a partially compiled candidate.
  return { bodies: issues.length ? [] : bodies, issues };
}
