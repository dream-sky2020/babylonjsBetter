// Battle.tsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { BattleStartUI } from './BattleStartUI';
import { BattleSkillUI } from './BattleSkillUI';
import { Engine, Mesh } from '@babylonjs/core';
import type { TrackedUiState, SkillVisualData } from '@app-types/battle.types';
import { hiddenTrackedUi } from '@app-types/battle.types';
import { createMockSprite, drawSpriteDebugHelper, uvToNormalizedAnchor } from './utils/mockSprite';
import { UiTracker } from './trackers/UiTracker';
import { UiTrackerManager } from './trackers/UiTrackerManager';
import { createBattleScene } from './scene/createScene';

export const Battle: React.FC = () => {
  const [isBattleStarting, setIsBattleStarting] = useState(false);
  const [webglError, setWebglError] = useState('');
  const [topSkillTrackedUi, setTopSkillTrackedUi] = useState<TrackedUiState>(hiddenTrackedUi);
  const [bottomSkillTrackedUi] = useState<TrackedUiState>(hiddenTrackedUi);
  const [centerSkillTrackedUi] = useState<TrackedUiState>(hiddenTrackedUi);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const trackerManagerRef = useRef<UiTrackerManager | null>(null);
  const reloadAnchorPresetRef = useRef<(() => void) | null>(null);
  const reportWebglError = useCallback((message: string) => {
    window.setTimeout(() => {
      setWebglError(message);
    }, 0);
  }, []);

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
    if (!Engine.IsSupported) {
      reportWebglError('当前环境不支持 WebGL，Battle 场景无法渲染。请检查浏览器硬件加速设置或切换浏览器。');
      return;
    }

    let sceneContext: ReturnType<typeof createBattleScene>;
    try {
      sceneContext = createBattleScene(canvas);
    } catch {
      reportWebglError('Battle 场景初始化失败：当前环境可能不支持 WebGL。');
      return;
    }
    const { scene, camera, engine, updateOrthographicFrustum, dispose } = sceneContext;

    // 创建图标平面（Battle 只关注“放置物体”）
    const iconTexturePath = encodeURI('/resources/优势.png');
    const mockSprite = createMockSprite(scene, iconTexturePath, 4.8, 'merged');
    const plane = mockSprite.mesh;
    let debugItems: Mesh[] = [];

    // 初始化追踪器管理器
    trackerManagerRef.current = new UiTrackerManager();

    const reloadAnchorPreset = () => {
      const preset = mockSprite.refreshPreset();

      debugItems.forEach((mesh) => mesh.dispose());
      debugItems = drawSpriteDebugHelper(mockSprite, scene);

      trackerManagerRef.current?.clear();
      trackerManagerRef.current = new UiTrackerManager();

      const headAnchorNormalized = uvToNormalizedAnchor(mockSprite.getAnchorUv('head'));
      const topTracker = new UiTracker(
        scene, camera, engine, plane, setTopSkillTrackedUi,
        {
          anchorMode: 'normalized',
          anchorNormalized: headAnchorNormalized,
          offsetMultiplier: 0,
          useBoundingEdgeOffset: false,
          extraOffset: 0.2,
          minScale: 0.3,
          maxScale: 1.4
        }
      );
      trackerManagerRef.current.addTracker(topTracker);

      console.log('[MockSprite Preset Reloaded]', preset);
    };
    reloadAnchorPresetRef.current = reloadAnchorPreset;
    reloadAnchorPreset();

    // 在渲染循环中更新所有追踪器
    scene.onBeforeRenderObservable.add(() => {
      if (trackerManagerRef.current) {
        trackerManagerRef.current.updateAll();
      }
    });

    engine.runRenderLoop(() => {
      scene.render();
    });

    const handleResize = () => {
      engine.resize();
      updateOrthographicFrustum();
    };
    window.addEventListener('resize', handleResize);

    return () => {
      reloadAnchorPresetRef.current = null;
      window.removeEventListener('resize', handleResize);
      debugItems.forEach((mesh) => mesh.dispose());

      if (trackerManagerRef.current) {
        trackerManagerRef.current.clear();
      }

      dispose();
    };
  }, [reportWebglError]);

  const handleStartBattle = () => {
    setIsBattleStarting(true);
  };

  const handleAnimationComplete = () => {
    setIsBattleStarting(false);
    console.log("战斗逻辑正式开始...");
  };

  const handleReloadAnchorPreset = () => {
    reloadAnchorPresetRef.current?.();
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
      {webglError ? (
        <div
          style={{
            position: 'absolute',
            left: 20,
            bottom: 20,
            zIndex: 30,
            pointerEvents: 'none',
            background: 'rgba(10, 12, 18, 0.8)',
            border: '1px solid rgba(255, 99, 99, 0.5)',
            color: '#ffd3d3',
            padding: '10px 12px',
            borderRadius: 8,
            maxWidth: 520,
            fontSize: 13,
            lineHeight: 1.5
          }}
        >
          {webglError}
        </div>
      ) : null}

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

          <button
            onClick={handleReloadAnchorPreset}
            style={{
              marginLeft: 10,
              padding: '12px 20px',
              fontSize: '14px',
              fontWeight: 'bold',
              color: '#fff',
              backgroundColor: '#3b82f6',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              boxShadow: '0 4px 6px rgba(59, 130, 246, 0.25)',
              transition: 'all 0.2s ease'
            }}
          >
            重载锚点配置
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

      {/* 6. 身体技能 UI（相对精灵平面） */}
      <BattleSkillUI
        trackedState={centerSkillTrackedUi}
        config={skillUiConfig}
        skillName="身体 UI"
      />
    </div>
  );
};