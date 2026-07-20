import { useCallback, useEffect, useRef, useState } from 'react';
import type { MutableRefObject } from 'react';
import { Engine, type ArcRotateCamera, type Scene } from '@babylonjs/core';
import { createSpriteAnchorEditorScene } from '@/core/scene/createSpriteAnchorEditorScene.ts';
import {
  SPRITE_ANIM_DEFAULT_ORTHO_SIZE,
  SPRITE_ANIM_MAX_ORTHO_SIZE,
  SPRITE_ANIM_MIN_ORTHO_SIZE,
  SPRITE_ANIM_ZOOM_STEP,
  clamp
} from '@/core/sprite';

interface UseBabylonSceneParams {
  setMessage: (message: string) => void;
}

interface UseBabylonSceneResult {
  canvasRef: MutableRefObject<HTMLCanvasElement | null>;
  sceneRef: MutableRefObject<Scene | null>;
  cameraRef: MutableRefObject<ArcRotateCamera | null>;
  /** 场景创建后递增，供预览 effect 依赖 */
  sceneEpoch: number;
  zoomLabel: string;
  resetView: () => void;
}

export const useBabylonScene = ({ setMessage }: UseBabylonSceneParams): UseBabylonSceneResult => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<Scene | null>(null);
  const cameraRef = useRef<ArcRotateCamera | null>(null);
  const resetViewRef = useRef<(() => void) | null>(null);
  const orthoSizeRef = useRef(SPRITE_ANIM_DEFAULT_ORTHO_SIZE);
  const isPanningRef = useRef(false);
  const lastPointerRef = useRef({ x: 0, y: 0 });
  const [zoomLabel, setZoomLabel] = useState('1.00x');
  const [sceneEpoch, setSceneEpoch] = useState(0);

  const resetView = useCallback(() => {
    resetViewRef.current?.();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (!Engine.IsSupported) {
      window.setTimeout(() => {
        setMessage('当前环境不支持 WebGL，无法初始化 Babylon 渲染。');
      }, 0);
      return;
    }

    let context: ReturnType<typeof createSpriteAnchorEditorScene>;
    try {
      context = createSpriteAnchorEditorScene(canvas);
    } catch {
      window.setTimeout(() => {
        setMessage('Babylon 引擎初始化失败。');
      }, 0);
      return;
    }

    const { engine, scene, camera, dispose } = context;
    sceneRef.current = scene;
    cameraRef.current = camera;
    setSceneEpoch((value) => value + 1);

    const updateOrtho = () => {
      const aspect = engine.getRenderWidth() / Math.max(1, engine.getRenderHeight());
      camera.orthoTop = orthoSizeRef.current;
      camera.orthoBottom = -orthoSizeRef.current;
      camera.orthoLeft = -orthoSizeRef.current * aspect;
      camera.orthoRight = orthoSizeRef.current * aspect;
      setZoomLabel(
        `${(SPRITE_ANIM_DEFAULT_ORTHO_SIZE / Math.max(orthoSizeRef.current, 0.001)).toFixed(2)}x`
      );
    };

    const resetViewInternal = () => {
      camera.target.set(0, 0, 0);
      orthoSizeRef.current = SPRITE_ANIM_DEFAULT_ORTHO_SIZE;
      updateOrtho();
    };
    resetViewRef.current = resetViewInternal;
    resetViewInternal();

    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const factor = event.deltaY > 0 ? 1 + SPRITE_ANIM_ZOOM_STEP : 1 - SPRITE_ANIM_ZOOM_STEP;
      orthoSizeRef.current = clamp(
        orthoSizeRef.current * factor,
        SPRITE_ANIM_MIN_ORTHO_SIZE,
        SPRITE_ANIM_MAX_ORTHO_SIZE
      );
      updateOrtho();
    };

    const onPointerDown = (event: PointerEvent) => {
      if (event.button === 1 || event.button === 2) {
        isPanningRef.current = true;
        lastPointerRef.current = { x: event.clientX, y: event.clientY };
      }
    };

    const onPointerMove = (event: PointerEvent) => {
      if (!isPanningRef.current) return;
      const dx = event.clientX - lastPointerRef.current.x;
      const dy = event.clientY - lastPointerRef.current.y;
      lastPointerRef.current = { x: event.clientX, y: event.clientY };
      const worldPerPixel =
        (orthoSizeRef.current * 2) / Math.max(1, engine.getRenderHeight());
      camera.target.x -= dx * worldPerPixel;
      camera.target.y += dy * worldPerPixel;
    };

    const onPointerUp = () => {
      isPanningRef.current = false;
    };

    const onResize = () => {
      engine.resize();
      updateOrtho();
    };

    canvas.addEventListener('wheel', onWheel, { passive: false });
    canvas.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('resize', onResize);
    canvas.addEventListener('contextmenu', (event) => event.preventDefault());

    engine.runRenderLoop(() => {
      scene.render();
    });

    return () => {
      canvas.removeEventListener('wheel', onWheel);
      canvas.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('resize', onResize);
      sceneRef.current = null;
      cameraRef.current = null;
      dispose();
    };
  }, [setMessage]);

  return { canvasRef, sceneRef, cameraRef, sceneEpoch, zoomLabel, resetView };
};
