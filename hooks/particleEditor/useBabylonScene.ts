import { useCallback, useEffect, useRef } from 'react';
import type { MutableRefObject } from 'react';
import { ArcRotateCamera, Camera, Engine, Scene, Vector3 } from '@babylonjs/core';
import type { ParticleController } from '../../utils/particleFactory';
import type { ViewMode } from './types';
import {
  DEFAULT_3D_CAMERA_ALPHA,
  DEFAULT_3D_CAMERA_BETA,
  DEFAULT_3D_CAMERA_RADIUS
} from '../../shared/core/scene/particleEditor.constants';
import { createParticleEditorScene } from '../../shared/core/scene/createParticleEditorScene';

const DEFAULT_3D_CAMERA_TARGET = Vector3.Zero();

const applyDefault3dCameraPose = (camera: ArcRotateCamera): void => {
  camera.mode = Camera.PERSPECTIVE_CAMERA;
  camera.lowerAlphaLimit = undefined;
  camera.upperAlphaLimit = undefined;
  camera.lowerBetaLimit = 0.1;
  camera.upperBetaLimit = Math.PI / 2.1;
  camera.lowerRadiusLimit = 2;
  camera.upperRadiusLimit = 30;
  camera.alpha = DEFAULT_3D_CAMERA_ALPHA;
  camera.beta = DEFAULT_3D_CAMERA_BETA;
  camera.radius = DEFAULT_3D_CAMERA_RADIUS;
  camera.target.copyFrom(DEFAULT_3D_CAMERA_TARGET);
};

interface UseBabylonSceneParams {
  viewMode: ViewMode;
  setMessage: (message: string) => void;
  particleControllerRef: MutableRefObject<ParticleController | null>;
}

interface UseBabylonSceneResult {
  canvasRef: MutableRefObject<HTMLCanvasElement | null>;
  sceneRef: MutableRefObject<Scene | null>;
  reset3dCameraView: () => void;
}

export const useBabylonScene = ({
  viewMode,
  setMessage,
  particleControllerRef
}: UseBabylonSceneParams): UseBabylonSceneResult => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<Scene | null>(null);
  const engineRef = useRef<Engine | null>(null);
  const cameraRef = useRef<ArcRotateCamera | null>(null);
  const syncOrthoRef = useRef<(() => void) | null>(null);

  const applyViewMode = useCallback((mode: ViewMode) => {
    const camera = cameraRef.current;
    if (!camera) return;

    if (mode === '2d') {
      camera.mode = Camera.ORTHOGRAPHIC_CAMERA;
      camera.alpha = -Math.PI / 2;
      camera.beta = Math.PI / 2;
      camera.radius = 8;
      camera.lowerAlphaLimit = -Math.PI / 2;
      camera.upperAlphaLimit = -Math.PI / 2;
      camera.lowerBetaLimit = Math.PI / 2;
      camera.upperBetaLimit = Math.PI / 2;
      camera.lowerRadiusLimit = 8;
      camera.upperRadiusLimit = 8;
      camera.panningSensibility = 120;
      syncOrthoRef.current?.();
      return;
    }

    applyDefault3dCameraPose(camera);
  }, []);

  const reset3dCameraView = useCallback(() => {
    if (viewMode !== '3d') return;
    const camera = cameraRef.current;
    if (!camera) return;
    applyDefault3dCameraPose(camera);
    setMessage('已恢复默认 3D 视角');
  }, [setMessage, viewMode]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (!Engine.IsSupported) {
      window.setTimeout(() => {
        setMessage('当前环境不支持 WebGL，无法初始化 Babylon 渲染。');
      }, 0);
      return;
    }

    let context: ReturnType<typeof createParticleEditorScene>;
    try {
      context = createParticleEditorScene(canvas);
    } catch {
      window.setTimeout(() => {
        setMessage('Babylon 引擎初始化失败：当前环境可能不支持 WebGL。');
      }, 0);
      return;
    }

    sceneRef.current = context.scene;
    engineRef.current = context.engine;
    cameraRef.current = context.camera;
    syncOrthoRef.current = context.syncOrthographicFrustum;

    applyDefault3dCameraPose(context.camera);

    const handleResize = () => {
      context.engine.resize();
      if (context.camera.mode === Camera.ORTHOGRAPHIC_CAMERA) {
        context.syncOrthographicFrustum();
      }
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      particleControllerRef.current?.dispose();
      particleControllerRef.current = null;
      context.dispose();
      sceneRef.current = null;
      cameraRef.current = null;
      engineRef.current = null;
      syncOrthoRef.current = null;
    };
  }, [particleControllerRef, setMessage]);

  useEffect(() => {
    applyViewMode(viewMode);
  }, [applyViewMode, viewMode]);

  return {
    canvasRef,
    sceneRef,
    reset3dCameraView
  };
};
