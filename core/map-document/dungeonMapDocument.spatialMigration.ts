import type { DungeonMapDocumentComponent, DungeonMapDocumentV2 } from './dungeonMapDocument.types.ts';
import { validateDungeonMapDocumentV2 } from './dungeonMapDocument.validation.ts';
import { compileSpatialDefinitions, type SpatialDefinitionIssue } from '../dungeon-spatial/dungeonSpatialDefinition.ts';

export type SpatialMigrationResult = {
  document?: DungeonMapDocumentV2;
  issues: SpatialDefinitionIssue[];
  changes: { entityId: string; sourceId: string; bodyId: string; colliderId: string }[];
  notes: string[];
};

/** Offline candidate conversion. Does not mutate input or activate new runtime rules. */
export function migrateDungeonSpatialDefinitions(source: DungeonMapDocumentV2): SpatialMigrationResult {
  const issues: SpatialDefinitionIssue[] = validateDungeonMapDocumentV2(source).map(issue => ({ path: issue.path ?? '', message: issue.message }));
  const changes: SpatialMigrationResult['changes'] = [];
  const notes: string[] = [];
  if (issues.length) return { issues, changes, notes };
  const document = structuredClone(source);
  const allIds = new Set(Object.values(document.components).flat().map(row => row.id));
  const allocateId = (sourceId: string, role: string) => {
    const base = `${sourceId}:${role}`;
    let candidate = base;
    for (let suffix = 1; allIds.has(candidate); suffix++) candidate = `${base}:${suffix}`;
    allIds.add(candidate); return candidate;
  };
  const append = (row: DungeonMapDocumentComponent) => (document.components[row.type] ??= []).push(row);
  const owners = new Set((document.components['spatial-body'] ?? []).map(row => row.entityId));
  for (const type of ['movement-obstacle', 'grid-agent'] as const) {
    for (const row of document.components[type] ?? []) {
      const path = `components.${type}.${row.id}`;
      if (owners.has(row.entityId)) { issues.push({ path, message: '同一 Entity 存在多份空间定义，不能自动选择权威。' }); continue; }
      owners.add(row.entityId);
      const known = new Set(['id', 'entityId', 'type', 'version', 'enabled', 'slot', 'spatialFootprint', ...(type === 'movement-obstacle' ? ['activeByDefault'] : ['initialFacing', 'blocksMovement', 'actionPeriod', 'priority', 'movementProfileId'])]);
      const unknown = Object.keys(row).filter(key => !known.has(key));
      if (unknown.length || row.version !== 1) {
        issues.push({ path, message: `无法无损解释版本或字段：${unknown.join(', ') || row.version}。` }); continue;
      }
      const agent = type === 'grid-agent';
      if (agent && (!Number.isInteger(row.actionPeriod) || (row.actionPeriod as number) < 1 || !Number.isInteger(row.priority) || typeof row.blocksMovement !== 'boolean')) {
        issues.push({ path, message: 'Agent 周期、优先级或阻挡值无效。' }); continue;
      }
      const attachment = (document.components['spatial-attachment'] ?? []).find(item => item.entityId === row.entityId);
      const target = (attachment?.targets as { kind: string }[] | undefined)?.[0];
      const bodyId = row.id; // Existing references remain attached to the same component identity.
      const colliderId = allocateId(row.id, 'collider');
      const footprint = row.spatialFootprint ?? (agent ? 'center' : 'full-tile');
      append({ id: bodyId, entityId: row.entityId, type: 'spatial-body', version: 1,
        ...(row.enabled === undefined ? {} : { enabled: row.enabled }), ...(row.slot === undefined ? {} : { slot: row.slot }),
        activeByDefault: agent ? true : row.activeByDefault, mobility: agent ? 'movable' : 'fixed', pushable: false,
        initialFacing: agent ? row.initialFacing : 'south', movementProfileId: agent ? row.movementProfileId : 'ground' });
      append({ id: colliderId, entityId: row.entityId, type: 'spatial-collider', version: 1,
        response: agent && !row.blocksMovement ? 'trigger' : 'block', footprint,
        shape: target?.kind === 'tile' ? (footprint === 'center' ? 'disc' : 'box') : target?.kind === 'point' ? 'point' : 'boundary',
        radius: 0.25, halfWidth: 0.5, halfHeight: 0.5, offsetX: 0, offsetY: 0 });
      if (agent) append({ id: allocateId(row.id, 'timing'), entityId: row.entityId, type: 'agent-timing', version: 1, actionPeriod: row.actionPeriod, priority: row.priority });
      changes.push({ entityId: row.entityId, sourceId: row.id, bodyId, colliderId });
    }
    delete document.components[type];
  }
  if (document.components.physics?.length) notes.push('physics 原样保留；迁移不激活方向、标签、条件或视线规则。');
  if (document.components['actor-spawn']?.length) notes.push('actor-spawn 仍是出生声明，不生成第二个玩家 Body；运行时装配负责实例化持久玩家。');
  if (changes.length) notes.push('center/full-tile 离散占位原样保留；0.25 半径只定义新连续几何，不替代旧格步通行语义。旧障碍默认不可推动。');
  issues.push(...compileSpatialDefinitions(document).issues);
  return { ...(issues.length ? {} : { document }), issues, changes, notes };
}
