import { migrateDungeonSpatialDefinitions } from '../../../core/map-document/dungeonMapDocument.spatialMigration.ts';
import type { DungeonMapDocumentV2 } from '../../../core/map-document/dungeonMapDocument.types.ts';

/** Normalize before creating both the editor Store and its saved comparison baseline. Never writes the source preset. */
export function prepareDungeonMapEditorDocument(source: DungeonMapDocumentV2): DungeonMapDocumentV2 {
  const result = migrateDungeonSpatialDefinitions(source);
  if (!result.document) throw new Error(result.issues.map(issue => issue.message).join('\n'));
  return result.document;
}
