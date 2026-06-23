// BattleSkillUI.tsx
import React from 'react';
import type { TrackedUiState, SkillVisualData } from '@app-types/battle.types';

// 你要求的默认技能视觉数据配置
const DEFAULT_SKILL_DATA: SkillVisualData = {
  icon: {
    source: "resources/Identity Skill Icons/Anatomize Hong Lu Icon.png",
    visible: true,
    offsetX: 0,
    offsetY: 0,
    scale: 1
  },
  border: {
    source: "resources/Skill Border Assets/Pride3.png",
    visible: true,
    offsetX: 0,
    offsetY: 0,
    scale: 1
  },
  mask: {
    source: "resources/Skill Border Background Assets/Def1BG.png",
    visible: true
  }
};

interface BattleSkillUiProps {
  trackedState: TrackedUiState;   // 绑定的 3D 追踪状态 (包含坐标、是否可见、3D远近缩放比例)
  config?: SkillVisualData | null;// 外部从接口获取的数据，如果不传，则直接使用上面的默认配置
  skillName?: string;             // 可选的技能名称
}

export const BattleSkillUI: React.FC<BattleSkillUiProps> = ({ 
  trackedState, 
  config = DEFAULT_SKILL_DATA, // 采用要求的默认数据作为 Fallback
  skillName 
}) => {
  // 如果当前 3D 追踪点不可见，或者未配置数据，或者核心图标不可见则不渲染
  if (!trackedState.visible || !config || !config.icon?.visible) return null;

  // 1. 解析遮罩层样式 (利用 CSS mask-image 裁剪)
  const maskUrl = config.mask?.visible && config.mask.source 
    ? `url("/${config.mask.source}")` 
    : 'none';

  const maskStyle: React.CSSProperties = {
    WebkitMaskImage: maskUrl,
    maskImage: maskUrl,
    WebkitMaskSize: '100% 100%',
    maskSize: '100% 100%',
    WebkitMaskRepeat: 'no-repeat',
    maskRepeat: 'no-repeat',
    WebkitMaskPosition: 'center',
    maskPosition: 'center',
    width: '100%',
    height: '100%',
    position: 'absolute',
    top: 0,
    left: 0,
  };

  return (
    <div
      style={{
        position: 'absolute',
        // 核心：将 3D 物体投影到屏幕上的 X, Y 映射为 HTML 的绝对定位
        left: `${trackedState.x}px`,
        top: `${trackedState.y}px`,
        // translate(-50%, -50%) 确保图标中心对齐 3D 平面中心点
        // scale(${trackedState.scale}) 让图标具备 3D 远近相机的缩放感
        transform: `translate(-50%, -50%) scale(${trackedState.scale})`,
        transformOrigin: 'center center',
        zIndex: 25,
        pointerEvents: 'none', // 穿透鼠标事件，不妨碍 3D 场景拖拽
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '6px'
      }}
    >
      {/* 技能主体图层容器 (128x128 像素) */}
      <div
        style={{
          position: 'relative',
          width: '128px',
          height: '128px',
          userSelect: 'none'
        }}
      >
        {/* 中层：受遮罩裁剪的技能 Icon */}
        <div style={maskStyle}>
          {config.icon.source && (
            <img
              src={`/${config.icon.source}`}
              alt="Skill Icon"
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                objectFit: 'contain',
                transformOrigin: 'center center',
                // 还原合成器中的微调位移与缩放
                transform: `translate(${config.icon.offsetX || 0}px, ${config.icon.offsetY || 0}px) scale(${config.icon.scale || 1})`,
              }}
            />
          )}
        </div>

        {/* 顶层：不受遮罩裁剪的技能边框 (Border) */}
        {config.border?.visible && config.border.source && (
          <img
            src={`/${config.border.source}`}
            alt="Skill Border"
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              objectFit: 'contain',
              zIndex: 3,
              transformOrigin: 'center center',
              // 还原合成器中边框的微调位移与缩放
              transform: `translate(${config.border.offsetX || 0}px, ${config.border.offsetY || 0}px) scale(${config.border.scale || 1})`,
            }}
          />
        )}
      </div>

      {/* 技能名称悬浮文本标签 */}
      {skillName && (
        <div
          style={{
            color: '#fff',
            background: 'rgba(15, 15, 20, 0.85)',
            padding: '3px 10px',
            borderRadius: '4px',
            fontSize: '12px',
            fontWeight: 'bold',
            border: '1px solid rgba(255, 255, 255, 0.15)',
            textShadow: '1px 1px 2px #000',
            whiteSpace: 'nowrap',
            boxShadow: '0 2px 6px rgba(0,0,0,0.3)'
          }}
        >
          {skillName}
        </div>
      )}
    </div>
  );
};