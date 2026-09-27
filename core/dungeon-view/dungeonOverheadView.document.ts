import { DungeonMapDocumentQuery } from '../map-document/dungeonMapDocument.query.ts';
import type { DungeonMapDocumentV2 } from '../map-document/dungeonMapDocument.types.ts';
import { parseOverheadView } from './dungeonOverheadView.ts';

export const readDungeonOverheadView = (document: DungeonMapDocumentV2) => {
  const query = new DungeonMapDocumentQuery(document);
  const entries = query.getEntitiesAt({ kind: 'map' }).flatMap(({ id }) => {
    const entity = query.getEntitySnapshot(id);
    if (!entity || entity.enabled === false || entity.entityType !== 'dungeon-overhead-view') return [];
    return entity.components.filter(c => c.type === 'dungeon-overhead-view' && c.enabled !== false);
  });
  if (entries.length > 1) throw new Error('地图存在多个启用的俯视显示配置');
  if (entries[0] && entries[0].version !== 1) throw new Error('不支持的俯视配置组件版本');
  return entries.length ? parseOverheadView(entries[0]) : null;
};
