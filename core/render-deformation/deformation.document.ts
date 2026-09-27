import { DungeonMapDocumentQuery } from '../map-document/dungeonMapDocument.query.ts';
import type { DungeonMapDocumentV2 } from '../map-document/dungeonMapDocument.types.ts';
import { parseDeformationSettings } from './deformation.ts';

export function readDeformationSettings(document: DungeonMapDocumentV2) {
  const query = new DungeonMapDocumentQuery(document);
  const components = query.getEntitiesAt({ kind: 'map' }).flatMap(({ id }) => {
    const entity = query.getEntitySnapshot(id);
    return entity?.entityType === 'dungeon-overhead-view' && entity.enabled !== false
      ? entity.components.filter(c => c.type === 'visual-deformation') : [];
  });
  if (components.length > 1) throw new Error('地图存在多个显示变形配置');
  if (!components.length) return null;
  return parseDeformationSettings({ ...components[0], enabled: components[0].enabled !== false }, components[0].version);
}
