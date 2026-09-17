import {
  DUNGEON_MAP_CORNER_ORDER,
  DUNGEON_MAP_DIRECTION_ORDER,
  DUNGEON_MAP_DOCUMENT_SCHEMA_VERSION,
  type DungeonMapDocumentV2,
  type DungeonMapDocumentValidationIssue,
  type DungeonMapSpatialAttachmentComponent,
  type DungeonMapSpatialTarget,
} from './dungeonMapDocument.types.ts';

const targetKey = (target: DungeonMapSpatialTarget): string => {
  if (target.kind === 'map') return 'map';
  if (target.kind === 'tile') return `tile:${target.tileId}`;
  if (target.kind === 'side') return `side:${target.sideId}`;
  if (target.kind === 'edge') return `edge:${target.edgeId}`;
  return `point:${target.pointId}`;
};

export const validateDungeonMapDocumentV2 = (
  document: DungeonMapDocumentV2,
): DungeonMapDocumentValidationIssue[] => {
  const issues: DungeonMapDocumentValidationIssue[] = [];
  const add = (code: string, message: string, path?: string): void => {
    issues.push({ code, message, path });
  };
  const { grid } = document;

  if (document.schemaVersion !== DUNGEON_MAP_DOCUMENT_SCHEMA_VERSION) {
    add('document.schema-version', `不支持地图文档版本 ${String(document.schemaVersion)}。`, 'schemaVersion');
  }
  if (!document.identity.id.trim()) add('document.identity.id', '地图 ID 不能为空。', 'identity.id');
  if (!document.identity.presetKey.trim()) add('document.identity.preset-key', '地图预设 Key 不能为空。', 'identity.presetKey');
  if (!Number.isInteger(grid.width) || grid.width <= 0 || !Number.isInteger(grid.height) || grid.height <= 0) {
    add('grid.size', '地图宽高必须是正整数。', 'grid');
  }
  const expectedTiles = grid.width * grid.height;
  if (grid.tileIds.length !== expectedTiles) {
    add('grid.tile-count', `tileIds 应包含 ${expectedTiles} 项，实际为 ${grid.tileIds.length} 项。`, 'grid.tileIds');
  }
  if (grid.tileSides.length !== grid.tileIds.length) {
    add('grid.tile-side-count', 'tileSides 必须与 tileIds 一一对应。', 'grid.tileSides');
  }
  if (grid.tilePoints.length !== grid.tileIds.length) {
    add('grid.tile-point-count', 'tilePoints 必须与 tileIds 一一对应。', 'grid.tilePoints');
  }

  const unique = (values: readonly string[], code: string, path: string): Set<string> => {
    const result = new Set<string>();
    values.forEach((value, index) => {
      if (!value) add(`${code}.empty`, 'ID 不能为空。', `${path}[${index}]`);
      if (result.has(value)) add(`${code}.duplicate`, `ID“${value}”重复。`, `${path}[${index}]`);
      result.add(value);
    });
    return result;
  };

  const tileIds = unique(grid.tileIds, 'grid.tile-id', 'grid.tileIds');
  const sideIds = unique(grid.sides.map(({ id }) => id), 'grid.side-id', 'grid.sides');
  const edgeIds = unique(grid.edges.map(({ id }) => id), 'grid.edge-id', 'grid.edges');
  const pointIds = unique(grid.points.map(({ id }) => id), 'grid.point-id', 'grid.points');
  const entityIds = unique(document.entities.map(({ id }) => id), 'entity.id', 'entities');

  if (document.terrain) {
    if (!document.terrain.default || typeof document.terrain.default !== 'object'
      || Array.isArray(document.terrain.default)) {
      add('terrain.default', 'terrain.default 必须是地形属性对象。', 'terrain.default');
    }
    if (document.terrain.overrides) {
      Object.entries(document.terrain.overrides).forEach(([tileId, properties]) => {
        if (!tileIds.has(tileId)) {
          add('terrain.override.missing-tile', `地形覆盖引用了不存在的 Tile“${tileId}”。`, `terrain.overrides.${tileId}`);
        }
        if (!properties || typeof properties !== 'object' || Array.isArray(properties)) {
          add('terrain.override.properties', `Tile“${tileId}”的地形覆盖必须是对象。`, `terrain.overrides.${tileId}`);
        }
      });
    }
  }

  grid.tileSides.forEach((directions, tileIndex) => {
    if (directions.length !== DUNGEON_MAP_DIRECTION_ORDER.length) {
      add('grid.tile-sides.shape', '每个 tileSides 必须包含固定的 NESW 四项。', `grid.tileSides[${tileIndex}]`);
    }
    directions.forEach((sideId, directionIndex) => {
      if (!sideIds.has(sideId)) {
        add('grid.tile-sides.missing-side', `方向槽引用了不存在的 Side“${sideId}”。`, `grid.tileSides[${tileIndex}][${directionIndex}]`);
      }
    });
  });

  const sideById = new Map(grid.sides.map((side) => [side.id, side]));
  grid.sides.forEach((side, index) => {
    if (!tileIds.has(side.tileId)) add('grid.side.missing-tile', `Side“${side.id}”引用了不存在的 Tile。`, `grid.sides[${index}].tileId`);
    if (!edgeIds.has(side.edgeId)) add('grid.side.missing-edge', `Side“${side.id}”引用了不存在的 Edge。`, `grid.sides[${index}].edgeId`);
    const tileIndex = grid.tileIds.indexOf(side.tileId);
    const directionIndex = DUNGEON_MAP_DIRECTION_ORDER.indexOf(side.direction);
    if (tileIndex >= 0 && directionIndex >= 0 && grid.tileSides[tileIndex]?.[directionIndex] !== side.id) {
      add('grid.side.slot-mismatch', `Side“${side.id}”没有位于所属 Tile 的 ${side.direction} 槽。`, `grid.sides[${index}]`);
    }
  });

  grid.edges.forEach((edge, index) => {
    if (edge.sideIds.length < 1 || edge.sideIds.length > 2) {
      add('grid.edge.side-count', `Edge“${edge.id}”只能连接一个或两个 Side。`, `grid.edges[${index}].sideIds`);
    }
    edge.sideIds.forEach((sideId) => {
      const side = sideById.get(sideId);
      if (!side) add('grid.edge.missing-side', `Edge“${edge.id}”引用了不存在的 Side“${sideId}”。`, `grid.edges[${index}].sideIds`);
      else if (side.edgeId !== edge.id) add('grid.edge.back-reference', `Side“${sideId}”没有反向引用 Edge“${edge.id}”。`, `grid.edges[${index}]`);
    });
  });

  grid.tilePoints.forEach((corners, tileIndex) => {
    if (corners.length !== DUNGEON_MAP_CORNER_ORDER.length) {
      add('grid.tile-points.shape', '每个 tilePoints 必须包含固定的 NW/NE/SE/SW 四项。', `grid.tilePoints[${tileIndex}]`);
    }
    corners.forEach((pointId, cornerIndex) => {
      if (!pointIds.has(pointId)) {
        add('grid.tile-points.missing-point', `角槽引用了不存在的 Point“${pointId}”。`, `grid.tilePoints[${tileIndex}][${cornerIndex}]`);
      }
    });
  });

  const componentIds = new Set<string>();
  Object.entries(document.components).forEach(([tableType, components]) => {
    components.forEach((component, index) => {
      const path = `components.${tableType}[${index}]`;
      if (component.type !== tableType) add('component.table-type', `组件类型“${component.type}”与所在表“${tableType}”不一致。`, path);
      if (componentIds.has(component.id)) add('component.id.duplicate', `组件 ID“${component.id}”重复。`, `${path}.id`);
      componentIds.add(component.id);
      if (!entityIds.has(component.entityId)) add('component.missing-entity', `组件“${component.id}”引用了不存在的 Entity。`, `${path}.entityId`);
    });
  });

  const attachments = (document.components['spatial-attachment'] ?? []) as DungeonMapSpatialAttachmentComponent[];
  attachments.forEach((attachment, index) => {
    if (!Array.isArray(attachment.targets)) {
      add('attachment.targets', '空间挂载组件必须提供 targets 数组。', `components.spatial-attachment[${index}].targets`);
      return;
    }
    const seen = new Set<string>();
    attachment.targets.forEach((target, targetIndex) => {
      const key = targetKey(target);
      if (seen.has(key)) add('attachment.duplicate-target', `空间目标“${key}”重复。`, `components.spatial-attachment[${index}].targets[${targetIndex}]`);
      seen.add(key);
      const exists = target.kind === 'map'
        || (target.kind === 'tile' && tileIds.has(target.tileId))
        || (target.kind === 'side' && sideIds.has(target.sideId))
        || (target.kind === 'edge' && edgeIds.has(target.edgeId))
        || (target.kind === 'point' && pointIds.has(target.pointId));
      if (!exists) add('attachment.missing-target', `空间目标“${key}”不存在。`, `components.spatial-attachment[${index}].targets[${targetIndex}]`);
    });
  });

  return issues;
};
