import { useCallback, useEffect, useRef, useState } from 'react';
import type { MutableRefObject } from 'react';
import type { SpriteAnchorPreset } from '@app-types/sprite-anchors.types';
import { Scene, Vector3, Engine } from '@babylonjs/core';
import type { MockSprite } from '../../shared/core/scene/mockSprite';
import { createSpriteAnchorEditorScene } from '../../shared/core/scene/createSpriteAnchorEditorScene';
import {
  DEFAULT_ORTHO_SIZE,
  DRAG_HIT_RADIUS_UV,
  MAX_ORTHO_SIZE,
  MIN_ORTHO_SIZE,
  ZOOM_STEP,
  clamp,
  clamp01
} from '../../utils/spriteAnchorEditorHelpers';
import type { DragTarget } from '../../utils/spriteAnchorEditorHelpers';

interface UseBabylonSceneParams {
  presetRef: MutableRefObject<SpriteAnchorPreset>;
  spriteRef: MutableRefObject<MockSprite | null>;
  updatePresetByDrag: (target: Exclude<DragTarget, null>, u: number, v: number) => void;
  setMessage: React.Dispatch<React.SetStateAction<string>>;
}

interface UseBabylonSceneResult {
  canvasRef: MutableRefObject<HTMLCanvasElement | null>;
  sceneRef: MutableRefObject<Scene | null>;
  zoomLabel: string;
  resetView: () => void;
}

export const useBabylonScene = ({
  presetRef,
  spriteRef,
  updatePresetByDrag,
  setMessage
}: UseBabylonSceneParams): UseBabylonSceneResult => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<Scene | null>(null);
  const resetViewRef = useRef<(() => void) | null>(null);
  const draggingRef = useRef<DragTarget>(null);
  const isPanningRef = useRef(false);
  const lastPointerRef = useRef({ x: 0, y: 0 });
  const orthoSizeRef = useRef(DEFAULT_ORTHO_SIZE);
  const [zoomLabel, setZoomLabel] = useState('1.00x');

  const resetView = useCallback(() => {
    resetViewRef.current?.();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (!Engine.IsSupported) {
      window.setTimeout(() => {
        setMessage('当前环境不支持 WebGL，无法初始化 Babylon 渲染。请检查浏览器图形加速设置或更换支持 WebGL 的浏览器。');
      }, 0);
      return;
    }

    let context: ReturnType<typeof createSpriteAnchorEditorScene>;
    try {
      context = createSpriteAnchorEditorScene(canvas);
    } catch {
      window.setTimeout(() => {
        setMessage('Babylon 引擎初始化失败：当前环境可能不支持 WebGL。');
      }, 0);
      return;
    }
    const { engine, scene, camera } = context;
    sceneRef.current = scene;

    const updateOrtho = () => {
      const aspect = engine.getRenderWidth() / Math.max(1, engine.getRenderHeight());
      camera.orthoTop = orthoSizeRef.current;
      camera.orthoBottom = -orthoSizeRef.current;
      camera.orthoLeft = -orthoSizeRef.current * aspect;
      camera.orthoRight = orthoSizeRef.current * aspect;
      setZoomLabel(`${(DEFAULT_ORTHO_SIZE / Math.max(orthoSizeRef.current, 0.001)).toFixed(2)}x`);
    };

    const resetViewInternal = () => {
      camera.target.set(0, 0, 0);
      orthoSizeRef.current = DEFAULT_ORTHO_SIZE;
      updateOrtho();
    };
    resetViewRef.current = resetViewInternal;
    resetViewInternal();

    const toRenderCoords = (event: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      return {
        x: ((event.clientX - rect.left) / Math.max(rect.width, 1)) * engine.getRenderWidth(),
        y: ((event.clientY - rect.top) / Math.max(rect.height, 1)) * engine.getRenderHeight()
      };
    };

    const pickSpriteUv = (event: PointerEvent) => {
      const sprite = spriteRef.current;
      if (!sprite) return null;
      const pos = toRenderCoords(event);
      const pick = scene.pick(pos.x, pos.y, (mesh) => mesh === sprite.mesh, false, camera);
      const uv = pick?.getTextureCoordinates();
      if (!pick?.hit || !uv) return null;
      return { u: clamp01(uv.x), v: clamp01(uv.y) };
    };

    const resolveDragTarget = (u: number, v: number): DragTarget => {
      const current = presetRef.current;
      const anchors = current.anchors;
      const nearest = (Object.keys(anchors) as Array<keyof typeof anchors>)
        .map((key) => {
          const anchor = anchors[key];
          const dist = Math.hypot(anchor.u - u, anchor.v - v);
          return { key, dist };
        })
        .sort((a, b) => a.dist - b.dist)[0];

      if (nearest && nearest.dist <= DRAG_HIT_RADIUS_UV) return nearest.key;
      if (Math.abs(current.bodyAxisX - u) <= DRAG_HIT_RADIUS_UV) return 'axis';
      return null;
    };

    const handlePointerDown = (event: PointerEvent) => {
      if (event.button !== 0) return;
      const uv = pickSpriteUv(event);
      if (!uv) {
        isPanningRef.current = true;
        lastPointerRef.current = { x: event.clientX, y: event.clientY };
        return;
      }
      const dragTarget = resolveDragTarget(uv.u, uv.v);
      draggingRef.current = dragTarget;
      if (!dragTarget) {
        isPanningRef.current = true;
        lastPointerRef.current = { x: event.clientX, y: event.clientY };
      }
    };

    const handlePointerMove = (event: PointerEvent) => {
      const dragTarget = draggingRef.current;
      if (dragTarget) {
        const uv = pickSpriteUv(event);
        if (!uv) return;
        updatePresetByDrag(dragTarget, uv.u, uv.v);
        return;
      }
      if (!isPanningRef.current) return;

      const deltaX = event.clientX - lastPointerRef.current.x;
      const deltaY = event.clientY - lastPointerRef.current.y;
      lastPointerRef.current = { x: event.clientX, y: event.clientY };

      const worldWidth = (camera.orthoRight ?? 0) - (camera.orthoLeft ?? 0);
      const worldHeight = (camera.orthoTop ?? 0) - (camera.orthoBottom ?? 0);
      const worldPerPixelX = worldWidth / Math.max(1, engine.getRenderWidth());
      const worldPerPixelY = worldHeight / Math.max(1, engine.getRenderHeight());
      camera.target.addInPlace(new Vector3(-deltaX * worldPerPixelX, deltaY * worldPerPixelY, 0));
    };

    const handlePointerUp = () => {
      draggingRef.current = null;
      isPanningRef.current = false;
    };

    const handleWheel = (event: WheelEvent) => {
      event.preventDefault();
      const direction = Math.sign(event.deltaY);
      if (direction === 0) return;
      const nextSize = orthoSizeRef.current * (1 + direction * ZOOM_STEP);
      orthoSizeRef.current = clamp(nextSize, MIN_ORTHO_SIZE, MAX_ORTHO_SIZE);
      updateOrtho();
    };

    const handleResize = () => {
      engine.resize();
      updateOrtho();
    };

    canvas.addEventListener('pointerdown', handlePointerDown);
    canvas.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    canvas.addEventListener('wheel', handleWheel, { passive: false });
    window.addEventListener('resize', handleResize);

    engine.runRenderLoop(() => scene.render());

    return () => {
      canvas.removeEventListener('pointerdown', handlePointerDown);
      canvas.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      canvas.removeEventListener('wheel', handleWheel);
      window.removeEventListener('resize', handleResize);
      resetViewRef.current = null;
      context.dispose();
      sceneRef.current = null;
    };
  }, [presetRef, setMessage, spriteRef, updatePresetByDrag]);

  return {
    canvasRef,
    sceneRef,
    zoomLabel,
    resetView
  };
};
