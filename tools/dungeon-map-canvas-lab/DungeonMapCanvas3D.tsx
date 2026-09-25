import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { IEntity, IEntityContainer } from '@/core/entity';
import { DungeonMapDocumentQuery, type DungeonMapData, type DungeonMapDocumentV2, type DungeonMapDirection } from '@/core/map';
import type { DungeonMapEntityTypeColors } from '@/core/ui/dungeon-map-svg-tint';
import type { DungeonMapEntityMove, DungeonMapSelection, DungeonMapSelectionMode } from '@/core/ui/DungeonMapCanvas';
import {
  createDungeonMapCanvasView,
  createLegacyDungeonMapCanvasView,
  type DungeonMapCanvasView,
} from '@/core/ui/dungeon-map-canvas-view';
import {
  DUNGEON_MAP_ENTITY_BASE_Z,
  DUNGEON_MAP_ENTITY_DEPTH_STEP,
  layoutDungeonMapEntityDepthStack,
} from '@/core/ui/dungeon-map-entity-stack';
import {
  dungeonMapSpaceMetrics,
  dungeonMapTopologyColors,
  northTileSidePolygon,
} from '@/core/ui/dungeon-map-space-geometry';
import { createDungeonMapEntityVisual, type DungeonMapEntityVisual } from './dungeonMapCanvas3DVisual';

type Props = {
  document?: DungeonMapDocumentV2;
  map?: DungeonMapData;
  entityTypeColors: DungeonMapEntityTypeColors;
  selections: DungeonMapSelection[];
  selectedEntityId: string;
  selectionMode: DungeonMapSelectionMode;
  showGrid: boolean;
  showCoordinates: boolean;
  cellSize: number;
  edgeThicknessRatio: number;
  sharedEdgeThicknessRatio: number;
  zoom: number;
  onSelectionsChange: (selections: DungeonMapSelection[]) => void;
  onEntitySelect: (entityId: string, location: DungeonMapSelection) => void;
  onEntityMove: (move: DungeonMapEntityMove) => void;
};

type EntityPick = {
  kind: 'entity';
  entityId: string;
  entityType: string;
  label: string;
  location: DungeonMapSelection;
};
type SpacePick = { kind: 'space'; location: DungeonMapSelection };
type ScenePick = EntityPick | SpacePick;
type EntitySlot = {
  key: string;
  shapeKey: string;
  entity: IEntity;
  label: string;
  color: string;
  location: DungeonMapSelection;
  x: number;
  y: number;
  z: number;
};
type EntityInstance = {
  key: string;
  shapeKey: string;
  visual: DungeonMapEntityVisual;
  pick: EntityPick;
};
type SceneInputs = Props & {
  view: DungeonMapCanvasView | null;
};

type SpaceMetrics = ReturnType<typeof dungeonMapSpaceMetrics>;
const directionVector: Record<DungeonMapDirection, { x: number; y: number }> = {
  north: { x: 0, y: 1 }, east: { x: 1, y: 0 },
  south: { x: 0, y: -1 }, west: { x: -1, y: 0 },
};
const locationKey = (location: DungeonMapSelection) => {
  if (location.mode === 'shared') return `shared:${location.sharedEdgeId}`;
  if (location.mode === 'point') return `point:${location.sharedPointId}`;
  return `${location.mode}:${location.x}:${location.y}:${location.direction ?? ''}`;
};
const visualKey = (entityId: string, location: DungeonMapSelection) => (
  `${entityId}|${location.mode}:${location.x}:${location.y}:${location.direction ?? ''}:${location.sharedEdgeId ?? location.sharedPointId ?? ''}`
);
const tileXY = (view: DungeonMapCanvasView, metrics: SpaceMetrics, x: number, y: number) => ({
  x: (x - (view.width - 1) / 2) * metrics.pitch,
  y: ((view.height - 1) / 2 - y) * metrics.pitch,
});
const locationXY = (view: DungeonMapCanvasView, metrics: SpaceMetrics, location: DungeonMapSelection) => {
  if (location.mode === 'map') return { x: 0, y: view.height * metrics.pitch / 2 + 0.85 };
  if (location.mode === 'point') return {
    x: (location.x - view.width / 2) * metrics.pitch,
    y: (view.height / 2 - location.y) * metrics.pitch,
  };
  const center = tileXY(view, metrics, location.x, location.y);
  if (location.mode === 'edge' || location.mode === 'shared') {
    const vector = directionVector[location.direction ?? 'north'];
    const distance = location.mode === 'shared'
      ? (metrics.cell + metrics.gap) / 2
      : (metrics.cell - metrics.edgeThickness) / 2;
    return { x: center.x + vector.x * distance, y: center.y + vector.y * distance };
  }
  return center;
};

/** One attachment may have multiple visual positions on a wrapped map. */
const collectEntitySlots = (
  view: DungeonMapCanvasView,
  document: DungeonMapDocumentV2 | undefined,
  map: DungeonMapData | undefined,
  colors: DungeonMapEntityTypeColors,
  metrics: SpaceMetrics,
) => {
  const slots: EntitySlot[] = [];
  const idsByLocation = new Map<string, string[]>();
  const add = (data: IEntityContainer | undefined, location: DungeonMapSelection) => {
    const layers = layoutDungeonMapEntityDepthStack(data);
    idsByLocation.set(locationKey(location), layers.map(({ entity }) => entity.id));
    const xy = locationXY(view, metrics, location);
    layers.forEach(({ entity, z }, index) => {
      const label = entity.name?.trim() || entity.entityType || entity.id;
      const color = colors[entity.entityType] ?? '#94a3b8';
      slots.push({
        key: visualKey(entity.id, location),
        shapeKey: `${location.mode}|${location.direction ?? ''}|${label}|${color}|${entity.enabled !== false}|${metrics.edgeThickness}|${metrics.sharedThickness}`,
        entity, label, color, location,
        x: xy.x - index * 0.035,
        y: xy.y + index * 0.035,
        z,
      });
    });
  };
  view.tiles.forEach((tile) => {
    add(tile.data, { mode: 'tile', x: tile.x, y: tile.y });
    (['north', 'east', 'south', 'west'] as const).forEach((direction) => {
      add(tile.edges[direction].data, { mode: 'edge', x: tile.x, y: tile.y, direction });
    });
  });
  if (metrics.hasSharedLayer) view.sharedEdges.forEach((edge) => {
    const seen = new Set<string>();
    edge.sides.forEach((side) => {
      const location: DungeonMapSelection = {
        mode: 'shared', x: side.x, y: side.y, direction: side.direction, sharedEdgeId: edge.id,
      };
      const xy = locationXY(view, metrics, location);
      const positionKey = `${Math.round(xy.x * 1000)}:${Math.round(xy.y * 1000)}`;
      if (seen.has(positionKey)) return;
      seen.add(positionKey);
      add(edge.edge.data, location);
    });
  });
  if (metrics.hasSharedLayer) view.sharedPoints.forEach((point) => {
    point.positions.forEach((position) => {
      add(point.point.data, {
        mode: 'point', x: position.gridX, y: position.gridY, sharedPointId: point.id,
      });
    });
  });
  const mapData = document
    ? new DungeonMapDocumentQuery(document).getContainerAt({ kind: 'map' })
    : map?.data;
  add(mapData, { mode: 'map', x: 0, y: 0 });
  return { slots, idsByLocation };
};

const topologyKey = (view: DungeonMapCanvasView, metrics: SpaceMetrics, showGrid: boolean, showCoordinates: boolean, hitPadding: number) => (
  JSON.stringify([
    view.width, view.height, metrics.edgeThickness, metrics.sharedThickness, showGrid, showCoordinates, hitPadding,
    view.tiles.map((tile) => [tile.x, tile.y]),
    view.sharedEdges.map((edge) => [edge.id, edge.sides]),
    view.sharedPoints.map((point) => [point.id, point.positions]),
  ])
);

export const DungeonMapCanvas3D = (props: Props) => {
  const hostRef = useRef<HTMLDivElement>(null);
  const runtimeRef = useRef<{
    sync: (inputs: SceneInputs) => void;
    highlight: (inputs: SceneInputs) => void;
    reset: () => void;
    camera: THREE.OrthographicCamera;
  } | null>(null);
  const [hover, setHover] = useState('');
  const [error, setError] = useState('');
  const view = useMemo(() => {
    if (props.document) return createDungeonMapCanvasView(props.document);
    if (props.map) return createLegacyDungeonMapCanvasView(props.map);
    return null;
  }, [props.document, props.map]);
  const latestRef = useRef<SceneInputs>({ ...props, view });
  latestRef.current = { ...props, view };

  useEffect(() => {
    const host = hostRef.current;
    const firstView = latestRef.current.view;
    if (!host || !firstView) return;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true });
    } catch (cause) {
      setError(`无法启动 Three.js：${cause instanceof Error ? cause.message : String(cause)}`);
      return;
    }
    setError('');
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.setClearColor('#07100d');
    renderer.domElement.className = 'dungeon-map-3d__canvas';
    renderer.domElement.setAttribute('aria-label', '3D 实体展开地图；拖动空白处旋转，滚轮缩放，拖动实体移动，Alt 拖动复制');
    host.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#07100d');
    scene.add(new THREE.HemisphereLight(0xe6fff1, 0x274538, 2.1));
    const sun = new THREE.DirectionalLight(0xffffff, 2.3);
    sun.position.set(-6, -8, 14);
    scene.add(sun);
    const fill = new THREE.DirectionalLight(0x7ee8bb, 0.65);
    fill.position.set(7, 5, 8);
    scene.add(fill);

    const firstMetrics = dungeonMapSpaceMetrics(1, latestRef.current.edgeThicknessRatio, latestRef.current.sharedEdgeThicknessRatio);
    const span = Math.max(firstView.width, firstView.height, 4) * firstMetrics.pitch;
    const camera = new THREE.OrthographicCamera(-span, span, span, -span, 0.01, span * 15);
    camera.up.set(0, 0, 1);
    const initialTarget = new THREE.Vector3(0, 0, 0.4);
    const initialPosition = new THREE.Vector3(span * 0.65, -span * 0.9, span * 1.08 + initialTarget.z);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.minPolarAngle = 0.16;
    controls.maxPolarAngle = 1.45;
    controls.minZoom = 0.35;
    controls.maxZoom = 6;
    const reset = () => {
      camera.position.copy(initialPosition);
      controls.target.copy(initialTarget);
      camera.zoom = latestRef.current.zoom;
      camera.updateProjectionMatrix();
      controls.update();
    };
    reset();

    const resize = () => {
      const width = Math.max(host.clientWidth, 1);
      const height = Math.max(host.clientHeight, 1);
      renderer.setSize(width, height, false);
      const frameHeight = span * 1.8;
      camera.left = -frameHeight * width / height / 2;
      camera.right = frameHeight * width / height / 2;
      camera.top = frameHeight / 2;
      camera.bottom = -frameHeight / 2;
      camera.updateProjectionMatrix();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(host);
    resize();

    const picks = new WeakMap<THREE.Object3D, ScenePick>();
    const entities = new Map<string, EntityInstance>();
    let entityMeshes: THREE.Object3D[] = [];
    let spaceMeshes: THREE.Object3D[] = [];
    let spaceMaterials = new Map<string, THREE.MeshBasicMaterial[]>();
    let idsByLocation = new Map<string, string[]>();
    let lastTopologyKey = '';
    let topologyGroup = new THREE.Group();
    scene.add(topologyGroup);
    let topologyResources: Array<{ dispose: () => void }> = [];

    const rebuildTopology = (nextView: DungeonMapCanvasView, metrics: SpaceMetrics, showGrid: boolean, showCoordinates: boolean, hitPadding: number) => {
      const key = topologyKey(nextView, metrics, showGrid, showCoordinates, hitPadding);
      if (key === lastTopologyKey) return;
      lastTopologyKey = key;
      scene.remove(topologyGroup);
      topologyResources.forEach((resource) => resource.dispose());
      topologyGroup = new THREE.Group();
      scene.add(topologyGroup);
      topologyResources = [];
      spaceMeshes = [];
      spaceMaterials = new Map();
      const borderPositions: number[] = [];
      const addSpace = (
        location: DungeonMapSelection, shape: THREE.BufferGeometry,
        color: string, opacity: number, surfaceZ: number,
        hitWidth?: number, hitDepth?: number, customHitShape?: THREE.BufferGeometry,
      ) => {
        const xy = locationXY(nextView, metrics, location);
        const surface = new THREE.MeshBasicMaterial({
          color,
          side: THREE.DoubleSide, transparent: opacity < 1, opacity, depthWrite: opacity > 0,
        });
        surface.userData.baseOpacity = opacity;
        surface.userData.baseColor = color;
        topologyResources.push(shape, surface);
        const mesh = new THREE.Mesh(shape, surface);
        mesh.position.set(xy.x, xy.y, surfaceZ);
        topologyGroup.add(mesh);
        picks.set(mesh, { kind: 'space', location });
        spaceMeshes.push(mesh);
        if (showGrid && (location.mode === 'edge' || (location.mode === 'tile' && surfaceZ === -0.03))) {
          const borderShape = new THREE.EdgesGeometry(shape);
          const positions = borderShape.getAttribute('position');
          for (let index = 0; index < positions.count; index += 1) {
            borderPositions.push(
              positions.getX(index) + xy.x,
              positions.getY(index) + xy.y,
              positions.getZ(index) + surfaceZ + 0.001,
            );
          }
          borderShape.dispose();
        }
        const matching = spaceMaterials.get(locationKey(location)) ?? [];
        matching.push(surface);
        spaceMaterials.set(locationKey(location), matching);
        if (customHitShape || (hitWidth !== undefined && hitDepth !== undefined)) {
          const hitShape = customHitShape ?? new THREE.PlaneGeometry(hitWidth!, hitDepth!);
          const hitMaterial = new THREE.MeshBasicMaterial({
            side: THREE.DoubleSide, transparent: true, opacity: 0, depthWrite: false,
          });
          topologyResources.push(hitShape, hitMaterial);
          const hitMesh = new THREE.Mesh(hitShape, hitMaterial);
          hitMesh.position.set(xy.x, xy.y, surfaceZ + 0.002);
          // Raycaster sees both layers; the camera skips the invisible picking layer.
          hitMesh.layers.set(1);
          topologyGroup.add(hitMesh);
          picks.set(hitMesh, { kind: 'space', location });
          spaceMeshes.push(hitMesh);
        }
      };
      const rectangle = (width: number, depth: number) => new THREE.PlaneGeometry(width, depth);
      const segmentHitShape = (length: number, radius: number, horizontal: boolean) => {
        const polygon = new THREE.Shape();
        const points: { x: number; y: number }[] = [];
        for (let index = 0; index <= 12; index += 1) {
          const angle = -Math.PI / 2 + index * Math.PI / 12;
          points.push({ x: length / 2 + Math.cos(angle) * radius, y: Math.sin(angle) * radius });
        }
        for (let index = 0; index <= 12; index += 1) {
          const angle = Math.PI / 2 + index * Math.PI / 12;
          points.push({ x: -length / 2 + Math.cos(angle) * radius, y: Math.sin(angle) * radius });
        }
        const oriented = points.map(({ x, y }) => horizontal ? { x, y } : { x: -y, y: x });
        polygon.moveTo(oriented[0].x, oriented[0].y);
        oriented.slice(1).forEach((point) => polygon.lineTo(point.x, point.y));
        polygon.closePath();
        return new THREE.ShapeGeometry(polygon);
      };
      const sideShape = (direction: DungeonMapDirection) => {
        const rotation = { north: 0, east: -Math.PI / 2, south: Math.PI, west: Math.PI / 2 }[direction];
        const vector = directionVector[direction];
        const centerDistance = (metrics.cell - metrics.edgeThickness) / 2;
        const points = northTileSidePolygon(metrics.cell, metrics.edgeThickness).map(({ x, y }) => ({
          x: x * Math.cos(rotation) + y * Math.sin(rotation) - vector.x * centerDistance,
          y: x * Math.sin(rotation) - y * Math.cos(rotation) - vector.y * centerDistance,
        }));
        const polygon = new THREE.Shape();
        polygon.moveTo(points[0].x, points[0].y);
        points.slice(1).forEach((point) => polygon.lineTo(point.x, point.y));
        polygon.closePath();
        return new THREE.ShapeGeometry(polygon);
      };
      const addCoordinate = (x: number, y: number, z: number) => {
        const canvas = document.createElement('canvas');
        canvas.width = 256;
        canvas.height = 64;
        const context = canvas.getContext('2d');
        if (context) {
          context.fillStyle = '#d8ffea';
          context.font = 'bold 34px sans-serif';
          context.textAlign = 'center';
          context.textBaseline = 'middle';
          context.fillText(`${x},${y}`, 128, 32);
        }
        const texture = new THREE.CanvasTexture(canvas);
        const shape = new THREE.PlaneGeometry(0.32, 0.08);
        const surface = new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false });
        topologyResources.push(texture, shape, surface);
        const label = new THREE.Mesh(shape, surface);
        const xy = tileXY(nextView, metrics, x, y);
        label.position.set(xy.x - metrics.cell * 0.26, xy.y + metrics.cell * 0.31, z);
        topologyGroup.add(label);
      };
      nextView.tiles.forEach((tile) => {
        const tileLocation: DungeonMapSelection = { mode: 'tile', x: tile.x, y: tile.y };
        addSpace(tileLocation, rectangle(metrics.cell, metrics.cell), dungeonMapTopologyColors.background, 1, -0.06);
        addSpace(tileLocation, rectangle(metrics.tileBodySize, metrics.tileBodySize),
          dungeonMapTopologyColors.tile, showGrid ? 1 : 0, -0.03);
        if (showCoordinates) addCoordinate(tile.x, tile.y, 0.035);
        (['north', 'east', 'south', 'west'] as const).forEach((direction) => {
          const horizontal = direction === 'north' || direction === 'south';
          addSpace({ mode: 'edge', x: tile.x, y: tile.y, direction }, sideShape(direction),
            dungeonMapTopologyColors.side, showGrid ? 1 : 0, -0.015,
            horizontal ? metrics.cell : metrics.edgeThickness + hitPadding * 2,
            horizontal ? metrics.edgeThickness + hitPadding * 2 : metrics.cell);
        });
      });
      if (metrics.hasSharedLayer) nextView.sharedEdges.forEach((edge) => {
        const seen = new Set<string>();
        edge.sides.forEach((side) => {
          const location: DungeonMapSelection = {
            mode: 'shared', x: side.x, y: side.y, direction: side.direction, sharedEdgeId: edge.id,
          };
          const xy = locationXY(nextView, metrics, location);
          const positionKey = `${Math.round(xy.x * 1000)}:${Math.round(xy.y * 1000)}`;
          if (seen.has(positionKey)) return;
          seen.add(positionKey);
          const horizontal = side.direction === 'north' || side.direction === 'south';
          const width = horizontal ? metrics.cell : metrics.sharedThickness;
          const depth = horizontal ? metrics.sharedThickness : metrics.cell;
          addSpace(location, rectangle(width, depth), dungeonMapTopologyColors.sharedEdge,
            showGrid ? 1 : 0, 0,
            undefined, undefined,
            segmentHitShape(metrics.cell, metrics.sharedThickness / 2 + hitPadding, horizontal));
        });
      });
      if (metrics.hasSharedLayer) nextView.sharedPoints.forEach((point) => {
        point.positions.forEach((position) => {
          addSpace({ mode: 'point', x: position.gridX, y: position.gridY, sharedPointId: point.id },
            rectangle(metrics.pointSize, metrics.pointSize), dungeonMapTopologyColors.point,
            showGrid ? 1 : 0, 0.015,
            undefined, undefined, new THREE.CircleGeometry(metrics.pointSize / 2 + hitPadding, 24));
        });
      });
      addSpace({ mode: 'map', x: 0, y: 0 }, rectangle(0.78, 0.78), '#214638', 1, -0.03);
      if (borderPositions.length > 0) {
        const borderShape = new THREE.BufferGeometry();
        borderShape.setAttribute('position', new THREE.Float32BufferAttribute(borderPositions, 3));
        const borderMaterial = new THREE.LineBasicMaterial({
          color: dungeonMapTopologyColors.outlineColor,
          transparent: true, opacity: dungeonMapTopologyColors.outlineOpacity, depthWrite: false,
        });
        topologyResources.push(borderShape, borderMaterial);
        topologyGroup.add(new THREE.LineSegments(borderShape, borderMaterial));
      }
    };

    const highlight = (inputs: SceneInputs) => {
      entities.forEach(({ visual, pick }) => {
        const selected = pick.entityId === inputs.selectedEntityId;
        visual.surfaces.forEach((surface) => {
          surface.emissive.set(selected ? '#3ce8d2' : '#000000');
          surface.emissiveIntensity = selected ? 1.4 : 1;
        });
      });
      const selectedSpaces = new Set(inputs.selections.map(locationKey));
      spaceMaterials.forEach((materials, key) => materials.forEach((surface) => {
        const selected = selectedSpaces.has(key);
        surface.color.set(selected ? '#ffd166' : String(surface.userData.baseColor));
        surface.opacity = selected && surface.userData.baseOpacity === 0
          ? 0.8 : Number(surface.userData.baseOpacity);
      }));
    };

    const sync = (inputs: SceneInputs) => {
      if (!inputs.view) return;
      const metrics = dungeonMapSpaceMetrics(1, inputs.edgeThicknessRatio, inputs.sharedEdgeThicknessRatio);
      const hitPadding = 5 / Math.max(8, inputs.cellSize);
      rebuildTopology(inputs.view, metrics, inputs.showGrid, inputs.showCoordinates, hitPadding);
      const collected = collectEntitySlots(inputs.view, inputs.document, inputs.map, inputs.entityTypeColors, metrics);
      idsByLocation = collected.idsByLocation;
      const desiredKeys = new Set(collected.slots.map((slot) => slot.key));
      const unused = [...entities.values()];
      const nextEntities = new Map<string, EntityInstance>();
      entityMeshes = [];
      collected.slots.forEach((slot) => {
        let instance = entities.get(slot.key);
        if (instance?.shapeKey !== slot.shapeKey) instance = undefined;
        if (!instance) instance = unused.find((candidate) => (
          candidate.pick.entityId === slot.entity.id
          && candidate.shapeKey === slot.shapeKey
          && !desiredKeys.has(candidate.key)
        ));
        if (instance) unused.splice(unused.indexOf(instance), 1);
        else {
          const visual = createDungeonMapEntityVisual(
            slot.label, slot.color, slot.location, metrics,
          );
          if (slot.entity.enabled === false) visual.surfaces.forEach((surface) => {
            surface.transparent = true;
            surface.opacity = 0.5;
          });
          const pick: EntityPick = {
            kind: 'entity', entityId: slot.entity.id,
            entityType: slot.entity.entityType, label: slot.label, location: slot.location,
          };
          visual.meshes.forEach((mesh) => picks.set(mesh, pick));
          scene.add(visual.group);
          instance = { key: slot.key, shapeKey: slot.shapeKey, visual, pick };
        }
        instance.key = slot.key;
        instance.pick.entityType = slot.entity.entityType;
        instance.pick.label = slot.label;
        instance.pick.location = slot.location;
        const position = instance.visual.group.position;
        if (position.x !== slot.x || position.y !== slot.y || position.z !== slot.z) {
          position.set(slot.x, slot.y, slot.z);
        }
        nextEntities.set(slot.key, instance);
        entityMeshes.push(...instance.visual.meshes);
      });
      unused.forEach((instance) => {
        scene.remove(instance.visual.group);
        instance.visual.dispose();
      });
      entities.clear();
      nextEntities.forEach((instance, key) => entities.set(key, instance));
      scene.updateMatrixWorld(true);
      highlight(inputs);
    };

    const raycaster = new THREE.Raycaster();
    raycaster.layers.enable(1);
    const pointer = new THREE.Vector2();
    const spacePriority: Record<DungeonMapSelection['mode'], number> = {
      point: 0, shared: 1, edge: 2, tile: 3, map: 4,
    };
    const pick = (event: PointerEvent, objects: THREE.Object3D[], mode?: DungeonMapSelectionMode): ScenePick | undefined => {
      const bounds = renderer.domElement.getBoundingClientRect();
      if (bounds.width === 0 || bounds.height === 0) return undefined;
      pointer.set(
        ((event.clientX - bounds.left) / bounds.width) * 2 - 1,
        -((event.clientY - bounds.top) / bounds.height) * 2 + 1,
      );
      raycaster.setFromCamera(pointer, camera);
      const hits = raycaster.intersectObjects(objects, false)
        .map((hit) => ({ result: picks.get(hit.object), distance: hit.distance }))
        .filter((hit): hit is { result: ScenePick; distance: number } => hit.result !== undefined)
        .filter(({ result }) => result.kind !== 'space' || !mode || mode === 'all' || result.location.mode === mode);
      if (objects === spaceMeshes) hits.sort((left, right) => (
        spacePriority[(left.result as SpacePick).location.mode]
        - spacePriority[(right.result as SpacePick).location.mode]
        || left.distance - right.distance
      ));
      return hits[0]?.result;
    };

    const guidePositions = new Float32Array(6);
    const guideGeometry = new THREE.BufferGeometry();
    guideGeometry.setAttribute('position', new THREE.BufferAttribute(guidePositions, 3));
    const guideMaterial = new THREE.LineBasicMaterial({
      color: '#ffe4a3', transparent: true, opacity: 0.9, depthTest: false,
    });
    const dropGuide = new THREE.Line(guideGeometry, guideMaterial);
    dropGuide.visible = false;
    dropGuide.renderOrder = 19;
    scene.add(dropGuide);
    let preview: DungeonMapEntityVisual | null = null;
    let previewShapeKey = '';
    const hidePreview = () => {
      if (preview) preview.group.visible = false;
      dropGuide.visible = false;
    };
    const showPreview = (entity: EntityPick, destination: DungeonMapSelection) => {
      if (locationKey(entity.location) === locationKey(destination)) {
        hidePreview();
        return;
      }
      const nextView = latestRef.current.view;
      if (!nextView) return;
      const metrics = dungeonMapSpaceMetrics(1, latestRef.current.edgeThicknessRatio, latestRef.current.sharedEdgeThicknessRatio);
      const color = latestRef.current.entityTypeColors[entity.entityType] ?? '#94a3b8';
      const shapeKey = `${destination.mode}|${destination.direction ?? ''}|${entity.label}|${color}|${metrics.edgeThickness}|${metrics.sharedThickness}`;
      if (!preview || previewShapeKey !== shapeKey) {
        if (preview) {
          scene.remove(preview.group);
          preview.dispose();
        }
        preview = createDungeonMapEntityVisual(
          entity.label, color, destination, metrics, true,
        );
        previewShapeKey = shapeKey;
        scene.add(preview.group);
      }
      const ids = idsByLocation.get(locationKey(destination)) ?? [];
      const existingIndex = ids.indexOf(entity.entityId);
      const index = existingIndex >= 0 ? existingIndex : ids.filter((id) => id < entity.entityId).length;
      const xy = locationXY(nextView, metrics, destination);
      const z = DUNGEON_MAP_ENTITY_BASE_Z + index * DUNGEON_MAP_ENTITY_DEPTH_STEP;
      preview.group.position.set(xy.x - index * 0.035, xy.y + index * 0.035, z);
      preview.group.visible = true;
      guidePositions.set([
        preview.group.position.x, preview.group.position.y, z + 0.23,
        preview.group.position.x, preview.group.position.y, z + Math.max(1.2, span * 0.24),
      ]);
      guideGeometry.attributes.position.needsUpdate = true;
      guideGeometry.computeBoundingSphere();
      dropGuide.visible = true;
    };

    let dragging: { entity: EntityPick; startX: number; startY: number; moved: boolean } | null = null;
    const canvas = renderer.domElement;
    const pointerDown = (event: PointerEvent) => {
      if (event.button !== 0) return;
      const entity = pick(event, entityMeshes);
      if (entity?.kind === 'entity') {
        dragging = { entity, startX: event.clientX, startY: event.clientY, moved: false };
        controls.enabled = false;
        canvas.setPointerCapture(event.pointerId);
        latestRef.current.onEntitySelect(entity.entityId, entity.location);
        event.preventDefault();
        return;
      }
      const mode = latestRef.current.selectionMode;
      if (mode === 'map') {
        latestRef.current.onSelectionsChange([{ mode: 'map', x: 0, y: 0 }]);
        return;
      }
      const space = pick(event, spaceMeshes, mode);
      latestRef.current.onSelectionsChange(space?.kind === 'space' ? [space.location] : []);
    };
    const pointerMove = (event: PointerEvent) => {
      if (dragging) {
        dragging.moved ||= Math.hypot(event.clientX - dragging.startX, event.clientY - dragging.startY) > 4;
        const target = pick(event, spaceMeshes);
        if (dragging.moved && target?.kind === 'space') {
          showPreview(dragging.entity, target.location);
          setHover(locationKey(dragging.entity.location) === locationKey(target.location)
            ? '当前位置：松开后保持不变'
            : `${event.altKey ? '复制' : '移动'}到 ${target.location.mode} (${target.location.x}, ${target.location.y})`);
        } else {
          hidePreview();
          setHover(dragging.moved ? '未指向可放置的空间' : '');
        }
        return;
      }
      // OrbitControls owns pointer movement while rotating or panning.
      if (event.buttons !== 0) return;
      const entity = pick(event, entityMeshes);
      setHover(entity?.kind === 'entity' ? `${entity.label} · ${entity.entityType} · ${entity.entityId}` : '');
    };
    const finishDrag = (event: PointerEvent, cancelled: boolean) => {
      const active = dragging;
      dragging = null;
      hidePreview();
      setHover('');
      controls.enabled = true;
      if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
      if (!active || cancelled || !active.moved) return;
      const destination = pick(event, spaceMeshes);
      if (destination?.kind !== 'space') return;
      if (locationKey(active.entity.location) === locationKey(destination.location)) return;
      latestRef.current.onEntityMove({
        entityId: active.entity.entityId,
        from: active.entity.location,
        to: destination.location,
        copy: event.altKey,
      });
    };
    const pointerUp = (event: PointerEvent) => finishDrag(event, false);
    const pointerCancel = (event: PointerEvent) => finishDrag(event, true);
    canvas.addEventListener('pointerdown', pointerDown, { capture: true });
    canvas.addEventListener('pointermove', pointerMove);
    canvas.addEventListener('pointerup', pointerUp);
    canvas.addEventListener('pointercancel', pointerCancel);

    runtimeRef.current = { sync, highlight, reset, camera };
    sync(latestRef.current);
    let frame = 0;
    const render = () => {
      frame = requestAnimationFrame(render);
      controls.update();
      renderer.render(scene, camera);
    };
    render();
    return () => {
      cancelAnimationFrame(frame);
      canvas.removeEventListener('pointerdown', pointerDown, { capture: true });
      canvas.removeEventListener('pointermove', pointerMove);
      canvas.removeEventListener('pointerup', pointerUp);
      canvas.removeEventListener('pointercancel', pointerCancel);
      observer.disconnect();
      controls.dispose();
      entities.forEach((instance) => instance.visual.dispose());
      topologyResources.forEach((resource) => resource.dispose());
      preview?.dispose();
      guideGeometry.dispose();
      guideMaterial.dispose();
      renderer.dispose();
      canvas.remove();
      runtimeRef.current = null;
    };
  }, []);

  useEffect(() => {
    runtimeRef.current?.sync(latestRef.current);
  }, [view, props.document, props.map, props.entityTypeColors, props.showGrid, props.showCoordinates, props.cellSize, props.edgeThicknessRatio, props.sharedEdgeThicknessRatio]);

  useEffect(() => {
    runtimeRef.current?.highlight(latestRef.current);
  }, [props.selectedEntityId, props.selections]);

  useEffect(() => {
    const camera = runtimeRef.current?.camera;
    if (!camera) return;
    camera.zoom = props.zoom;
    camera.updateProjectionMatrix();
  }, [props.zoom]);

  return <div className="dungeon-map-3d" ref={hostRef}>
    <div className="dungeon-map-3d__help">左键拖动空白处旋转 · 右键平移 · 滚轮缩放 · 拖动实体移动 · Alt 拖动复制</div>
    {hover ? <div className="dungeon-map-3d__hover">{hover}</div> : null}
    {error ? <div className="dungeon-map-3d__error" role="alert">{error}</div> : null}
    <button type="button" className="dungeon-map-3d__reset" onClick={() => runtimeRef.current?.reset()}>重置视角</button>
  </div>;
};
