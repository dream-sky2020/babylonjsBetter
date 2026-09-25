import * as THREE from 'three';
import type { DungeonMapSelection } from '@/core/ui/DungeonMapCanvas';
import { northTileSidePolygon, type DungeonMapSpaceMetrics } from '@/core/ui/dungeon-map-space-geometry';

export type DungeonMapEntityVisual = {
  group: THREE.Group;
  meshes: THREE.Mesh[];
  surfaces: THREE.MeshStandardMaterial[];
  dispose: () => void;
};

const labelTexture = (label: string) => {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 128;
  const context = canvas.getContext('2d');
  if (context) {
    context.fillStyle = '#f5fff9';
    context.font = 'bold 42px Segoe UI, Microsoft YaHei, sans-serif';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(Array.from(label).slice(0, 12).join(''), 256, 64, 488);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
};

/** 2D Canvas 的中心、单格边、共享边和交汇点槽位在 3D 中使用相同的长宽关系。 */
export const entityFootprint = (location: DungeonMapSelection, metrics: DungeonMapSpaceMetrics) => {
  if (location.mode === 'edge' || location.mode === 'shared') {
    const horizontal = location.direction === 'north' || location.direction === 'south';
    const thickness = location.mode === 'edge' ? metrics.edgeThickness : metrics.sharedThickness;
    return { width: (horizontal ? metrics.cell : thickness) * 0.82, depth: (horizontal ? thickness : metrics.cell) * 0.82 };
  }
  if (location.mode === 'point') return { width: metrics.pointSize * 0.82, depth: metrics.pointSize * 0.82 };
  if (location.mode === 'map') return { width: 0.56, depth: 0.56 };
  return { width: metrics.tileBodySize * 0.82, depth: metrics.tileBodySize * 0.82 };
};

export const createDungeonMapEntityVisual = (
  label: string,
  color: string,
  location: DungeonMapSelection,
  metrics: DungeonMapSpaceMetrics,
  ghost = false,
): DungeonMapEntityVisual => {
  const { width, depth } = entityFootprint(location, metrics);
  const group = new THREE.Group();
  const geometries: THREE.BufferGeometry[] = [];
  const materials: THREE.Material[] = [];
  const meshes: THREE.Mesh[] = [];
  const surfaces: THREE.MeshStandardMaterial[] = [];
  const geometry = <T extends THREE.BufferGeometry,>(value: T): T => { geometries.push(value); return value; };
  const surface = () => {
    const value = new THREE.MeshStandardMaterial({
      color, roughness: 0.45, metalness: 0.12,
      transparent: ghost, opacity: ghost ? 0.43 : 1,
      depthTest: !ghost, depthWrite: !ghost,
    });
    materials.push(value);
    surfaces.push(value);
    return value;
  };
  const add = (shape: THREE.BufferGeometry, z: number) => {
    const mesh = new THREE.Mesh(geometry(shape), surface());
    mesh.position.z = z;
    group.add(mesh);
    meshes.push(mesh);
    return mesh;
  };

  if (location.mode === 'edge') {
    // Reuse the ordinary Canvas trapezoid, scaled within its spatial slot.
    const trapezoid = new THREE.Shape();
    const direction = location.direction ?? 'north';
    const rotation = { north: 0, east: -Math.PI / 2, south: Math.PI, west: Math.PI / 2 }[direction];
    const vector = { north: { x: 0, y: 1 }, east: { x: 1, y: 0 }, south: { x: 0, y: -1 }, west: { x: -1, y: 0 } }[direction];
    const centerDistance = (metrics.cell - metrics.edgeThickness) / 2;
    const points = northTileSidePolygon(metrics.cell, metrics.edgeThickness).map(({ x, y }) => ({
      x: (x * Math.cos(rotation) + y * Math.sin(rotation) - vector.x * centerDistance) * 0.82,
      y: (x * Math.sin(rotation) - y * Math.cos(rotation) - vector.y * centerDistance) * 0.82,
    }));
    trapezoid.moveTo(points[0].x, points[0].y);
    points.slice(1).forEach((point) => trapezoid.lineTo(point.x, point.y));
    trapezoid.closePath();
    add(new THREE.ExtrudeGeometry(trapezoid, { depth: 0.16, bevelEnabled: false }), -0.08);
  } else if (location.mode === 'shared') {
    add(new THREE.BoxGeometry(width, depth, 0.15), 0);
  } else if (location.mode === 'point') {
    add(new THREE.BoxGeometry(width, depth, 0.15), 0);
  } else if (location.mode === 'map') {
    add(new THREE.BoxGeometry(width, depth, 0.08), 0);
  } else {
    add(new THREE.BoxGeometry(width, depth, 0.17), 0);
  }

  const texture = labelTexture(label);
  const captionMaterial = new THREE.MeshBasicMaterial({
    map: texture, transparent: true, opacity: ghost ? 0.7 : 1,
    depthTest: !ghost, depthWrite: false, side: THREE.DoubleSide,
  });
  materials.push(captionMaterial);
  const caption = new THREE.Mesh(geometry(new THREE.PlaneGeometry(width * 0.85, Math.min(depth * 0.3, 0.15))), captionMaterial);
  caption.position.z = 0.22;
  group.add(caption);
  meshes.push(caption);

  return {
    group, meshes, surfaces,
    dispose: () => {
      geometries.forEach((item) => item.dispose());
      materials.forEach((item) => item.dispose());
      texture.dispose();
    },
  };
};
