import type { DungeonMapDocumentV2, DungeonMapSpatialAttachmentComponent } from './dungeonMapDocument.types.ts';

/** 仅在格式边界迁移旧地图级出生点；已有 tile 挂载始终是位置权威。 */
export const migrateLegacyDungeonSpawnAttachments = (source: DungeonMapDocumentV2): DungeonMapDocumentV2 => {
  const spawns = source.components['actor-spawn'] ?? [];
  const attachments = (source.components['spatial-attachment'] ?? []) as DungeonMapSpatialAttachmentComponent[];
  const replacements = new Map<string, string>();
  for (const entity of source.entities.filter(({ entityType }) => entityType === 'spawn-point')) {
    const owned = attachments.filter(({ entityId }) => entityId === entity.id);
    const targets = owned.flatMap(({ targets }) => targets);
    if (!targets.some(({ kind }) => kind === 'map')) continue;
    const fail = (reason: string): never => {
      throw new Error(`地图“${source.identity.id}”出生点“${entity.id}”迁移失败：${reason}`);
    };
    if (owned.length !== 1 || targets.length !== 1) fail('地图级出生点具有冲突空间挂载。');
    const declarations = spawns.filter(({ entityId }) => entityId === entity.id);
    if (declarations.length === 0) fail('缺少 actor-spawn 出生坐标。');
    const tileIds = declarations.map(({ tileX, tileY }) => {
      if (typeof tileX !== 'number' || typeof tileY !== 'number'
        || !Number.isInteger(tileX) || !Number.isInteger(tileY)
        || tileX < 0 || tileY < 0 || tileX >= source.grid.width || tileY >= source.grid.height) {
        return fail(`出生坐标 (${String(tileX)}, ${String(tileY)}) 缺失、非法或超出地图有效范围。`);
      }
      const tileId = source.grid.tileIds[tileY * source.grid.width + tileX];
      if (!tileId) return fail('出生坐标没有对应的有效 Tile。');
      return tileId;
    });
    if (new Set(tileIds).size !== 1) fail('同一出生点的旧坐标相互冲突。');
    replacements.set(owned[0].id, tileIds[0]);
  }
  return {
    ...source,
    components: {
      ...source.components,
      ...(source.components['actor-spawn'] ? { 'actor-spawn': spawns.map((component) => {
        const next = { ...component };
        delete next.tileX;
        delete next.tileY;
        return next;
      }) } : {}),
      ...(source.components['spatial-attachment'] ? { 'spatial-attachment': attachments.map((attachment) => {
        const tileId = replacements.get(attachment.id);
        return tileId ? { ...attachment, targets: [{ kind: 'tile' as const, tileId }] } : attachment;
      }) } : {}),
    },
  };
};
