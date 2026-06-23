// Battle.tsx
import React, { useState, useEffect, useRef } from 'react';
import { BattleStartUI } from './BattleStartUI';
import { BattleSkillUI } from './BattleSkillUI';
import { Engine, Scene, ArcRotateCamera, Vector3, HemisphericLight, Color4 } from '@babylonjs/core';
import type { TrackedUiState, SkillVisualData } from '@app-types/battle.types';
import { hiddenTrackedUi } from '@app-types/battle.types';
import { createIconPlane } from './utils/babylonHelpers';
import { UiTracker } from './trackers/UiTracker';
import { UiTrackerManager } from './trackers/UiTrackerManager';

export const Battle: React.FC = () => {
  const [isBattleStarting, setIsBattleStarting] = useState(false);
  const [topSkillTrackedUi, setTopSkillTrackedUi] = useState<TrackedUiState>(hiddenTrackedUi);
  const [bottomSkillTrackedUi, setBottomSkillTrackedUi] = useState<TrackedUiState>(hiddenTrackedUi);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const trackerManagerRef = useRef<UiTrackerManager | null>(null);

  const skillUiConfig: SkillVisualData = {
    icon: {
      source: 'resources/Identity Skill Icons/Artwork Inspection Outis Icon.png',
      visible: true,
      offsetX: 0,
      offsetY: 0,
      scale: 1
    },
    border: {
      source: 'resources/Skill Border Assets/Pride3.png',
      visible: true,
      offsetX: 0,
      offsetY: 0,
      scale: 1
    },
    mask: {
      source: 'resources/Skill Border Background Assets/Def1BG.png',
      visible: true
    }
  };

  useEffect(() => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;
    const engine = new Engine(canvas, true);
    type SceneWithOrthoHelpers = Scene & {
      _updateOrtho?: () => void;
      _disposeCameraInteraction?: () => void;
    };

    const createScene = () => {
      const scene = new Scene(engine);
      scene.clearColor = new Color4(0.1, 0.1, 0.15, 1);

      // 1. 设置相机初始位置（alpha = -Math.PI / 2, beta = Math.PI / 2 使其从 Z 轴负方向垂直看向原点，完美面对默认平面的正面）
      const camera = new ArcRotateCamera("camera", -Math.PI / 2, Math.PI / 2, 10, Vector3.Zero(), scene);

      // 锁定旋转，只允许平移 + 缩放
      camera.lowerAlphaLimit = -Math.PI / 2;
      camera.upperAlphaLimit = -Math.PI / 2;
      camera.lowerBetaLimit = Math.PI / 2;
      camera.upperBetaLimit = Math.PI / 2;

      // 2. 开启正交模式
      camera.mode = ArcRotateCamera.ORTHOGRAPHIC_CAMERA;

      // 3. 定义正交相机的垂直视野范围大小（值越小，物体看起来越大）
      let orthoSize = 5;
      const minOrthoSize = 1.5;
      const maxOrthoSize = 14;
      const zoomStep = 0.1;

      // 4. 根据当前画布宽高比计算并更新正交相机的边界参数
      const updateOrthographicFrustum = () => {
        const aspectRatio = engine.getRenderWidth() / engine.getRenderHeight();
        camera.orthoTop = orthoSize;
        camera.orthoBottom = -orthoSize;
        camera.orthoLeft = -orthoSize * aspectRatio;
        camera.orthoRight = orthoSize * aspectRatio;
      };

      // 首次初始化正交边界
      updateOrthographicFrustum();

      // 鼠标左键拖拽平移视口（水平移动，不旋转）
      let isDragging = false;
      let previousX = 0;
      let previousY = 0;

      const handlePointerDown = (event: PointerEvent) => {
        if (event.button !== 0) return;
        isDragging = true;
        previousX = event.clientX;
        previousY = event.clientY;
      };

      const handlePointerMove = (event: PointerEvent) => {
        if (!isDragging) return;

        const deltaX = event.clientX - previousX;
        const deltaY = event.clientY - previousY;
        previousX = event.clientX;
        previousY = event.clientY;

        const worldWidth = (camera.orthoRight ?? 0) - (camera.orthoLeft ?? 0);
        const worldHeight = (camera.orthoTop ?? 0) - (camera.orthoBottom ?? 0);
        const worldPerPixelX = worldWidth / engine.getRenderWidth();
        const worldPerPixelY = worldHeight / engine.getRenderHeight();

        camera.target.addInPlace(new Vector3(-deltaX * worldPerPixelX, deltaY * worldPerPixelY, 0));
      };

      const handlePointerUp = () => {
        isDragging = false;
      };

      // 鼠标滚轮缩放正交视口
      const handleWheel = (event: WheelEvent) => {
        event.preventDefault();
        const direction = Math.sign(event.deltaY);
        if (direction === 0) return;

        const nextOrthoSize = orthoSize * (1 + direction * zoomStep);
        orthoSize = Math.min(maxOrthoSize, Math.max(minOrthoSize, nextOrthoSize));
        updateOrthographicFrustum();
      };

      canvas.addEventListener('pointerdown', handlePointerDown);
      canvas.addEventListener('pointermove', handlePointerMove);
      window.addEventListener('pointerup', handlePointerUp);
      canvas.addEventListener('wheel', handleWheel, { passive: false });

      const light = new HemisphericLight("light", new Vector3(0, 1, 0), scene);
      light.intensity = 0.7;

      // 创建图标平面 (此时平面正面默认面朝 Z 轴负方向，正好与相机相对)
      const iconTexturePath = encodeURI('/resources/优势.png');
      const plane = createIconPlane(scene, iconTexturePath, 4.8);

      // 初始化追踪器管理器
      trackerManagerRef.current = new UiTrackerManager();

      // 上方 UI：贴着平面上沿再上移一点
      const topTracker = new UiTracker(
        scene, camera, engine, plane, setTopSkillTrackedUi,
        {
          offsetDirection: 'up',
          offsetMultiplier: 1,
          extraOffset: 0.2,
          minScale: 0.3, // 提示：正交模式下不存在近大远小，缩放通常可以设为固定值 1.0，或者根据视口大小联动
          maxScale: 1.4,
          baseDistance: 10,
          baseOrthoHeight: 10
        }
      );
      trackerManagerRef.current.addTracker(topTracker);

      // 下方 UI：贴着平面下沿再下移一点
      const bottomTracker = new UiTracker(
        scene, camera, engine, plane, setBottomSkillTrackedUi,
        {
          offsetDirection: 'down',
          offsetMultiplier: 1,
          extraOffset: 0.2,
          minScale: 0.3,
          maxScale: 1.4,
          baseDistance: 10,
          baseOrthoHeight: 10
        }
      );
      trackerManagerRef.current.addTracker(bottomTracker);

      // 在渲染循环中更新所有追踪器
      scene.onBeforeRenderObservable.add(() => {
        if (trackerManagerRef.current) {
          trackerManagerRef.current.updateAll();
        }
      });

      // 将更新正交边界的方法挂载到 scene 上，方便外面 resize 监听时调用
      const typedScene = scene as SceneWithOrthoHelpers;
      typedScene._updateOrtho = updateOrthographicFrustum;
      typedScene._disposeCameraInteraction = () => {
        canvas.removeEventListener('pointerdown', handlePointerDown);
        canvas.removeEventListener('pointermove', handlePointerMove);
        window.removeEventListener('pointerup', handlePointerUp);
        canvas.removeEventListener('wheel', handleWheel);
      };

      return scene;
    };

    const scene = createScene();

    engine.runRenderLoop(() => {
      scene.render();
    });

    const handleResize = () => {
      engine.resize();
      // 5. 窗口大小改变时，必须重新计算正交相机的边界，否则画面会拉伸变形
      const typedScene = scene as SceneWithOrthoHelpers;
      if (typedScene._updateOrtho) {
        typedScene._updateOrtho();
      }
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      const typedScene = scene as SceneWithOrthoHelpers;
      if (typedScene._disposeCameraInteraction) {
        typedScene._disposeCameraInteraction();
      }
      
      if (trackerManagerRef.current) {
        trackerManagerRef.current.clear();
      }
      
      scene.dispose();
      engine.dispose();
    };
  }, []);

  const handleStartBattle = () => {
    setIsBattleStarting(true);
  };

  const handleAnimationComplete = () => {
    setIsBattleStarting(false);
    console.log("战斗逻辑正式开始...");
  };

// ==================== 完整的 RETURN 部分 ====================
return (
  <div style={{ width: '100vw', height: '100vh', position: 'relative', overflow: 'hidden' }}>
    {/* 1. 3D 渲染层 */}
    <canvas
      ref={canvasRef}
      style={{
        width: '100%',
        height: '100%',
        display: 'block',
        outline: 'none'
      }}
    />

    {/* 2. 页面普通 UI 交互层 */}
    <div
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        zIndex: 10,
        pointerEvents: 'none', // 这一层背景不阻挡对 3D 场景的拖拽
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'flex-start',
        paddingTop: '50px',
        fontFamily: 'sans-serif'
      }}
    >
      <div
        style={{
          pointerEvents: 'auto', // 仅让内部的控制面板阻挡点击
          textAlign: 'center',
          background: 'rgba(255, 255, 255, 0.85)',
          padding: '20px',
          borderRadius: '12px',
          boxShadow: '0 4px 20px rgba(0,0,0,0.2)'
        }}
      >
        <h2 style={{ margin: '0 0 10px 0', color: '#333' }}>战斗测试模块 (Babylon.js 结合版)</h2>
        <p style={{ margin: '0 0 20px 0', color: '#666', fontSize: '14px' }}>
          背景是真正的 3D 场景（试着用鼠标拖拽背景）
        </p>

        <button
          onClick={handleStartBattle}
          disabled={isBattleStarting}
          style={{
            padding: '12px 30px',
            fontSize: '16px',
            fontWeight: 'bold',
            color: '#fff',
            backgroundColor: isBattleStarting ? '#95a5a6' : '#e74c3c',
            border: 'none',
            borderRadius: '6px',
            cursor: isBattleStarting ? 'not-allowed' : 'pointer',
            boxShadow: isBattleStarting ? 'none' : '0 4px 6px rgba(231, 76, 60, 0.3)',
            transition: 'all 0.2s ease'
          }}
        >
          {isBattleStarting ? '准备战斗中...' : '发起战斗'}
        </button>
      </div>
    </div>

    {/* 3. 动画层：去掉原有的包裹 div，直接挂载。动画结束后 isBattleStarting 变为 false，它将完全从 DOM 中移除 */}
    {isBattleStarting && (
      <BattleStartUI 
        text="Battle Start!" 
        color="#ff2e2e" 
        glowColor="#8b0000" 
        onAnimationComplete={handleAnimationComplete} 
      />
    )}

    {/* 4. 上方技能 UI（相对精灵平面） */}
    <BattleSkillUI
      trackedState={topSkillTrackedUi}
      config={skillUiConfig}
      skillName="上方 UI"
    />

    {/* 5. 下方技能 UI（相对精灵平面） */}
    <BattleSkillUI
      trackedState={bottomSkillTrackedUi}
      config={skillUiConfig}
      skillName="下方 UI"
    />
  </div>
);
};