// BattleStartUI.tsx
import React, { useEffect, useState } from 'react';
import './battle-animation.css';

interface BattleStartUIProps {
  text?: string;         // 支持自定义文字，默认 "Battle Start!"
  color?: string;        // 支持自定义主色调（比如 'red', '#ff0055'），默认红色
  glowColor?: string;    // 支持自定义发光暗影色，默认 'darkred'
  onAnimationComplete: () => void;
}

export const BattleStartUI: React.FC<BattleStartUIProps> = ({
  text = "Battle Start!",
  color = "red",
  glowColor = "darkred",
  onAnimationComplete
}) => {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    // 动画总时长为 3 秒 (2.5s 展示 + 0.5s 淡出)，之后触发完成回调并彻底销毁
    const timer = setTimeout(() => {
      setIsVisible(false); // 从 DOM 中移除
      onAnimationComplete();
    }, 3000);

    return () => clearTimeout(timer);
  }, [onAnimationComplete]);

  // 如果动画结束，直接返回 null，让组件彻底从 DOM 树中消失
  if (!isVisible) return null;

  // 将颜色通过 style 传递给 CSS 变量
  const themeStyle = {
    '--theme-color': color,
    '--theme-glow': glowColor,
  } as React.CSSProperties;

  return (
    <div className="battle-ui-overlay" style={themeStyle}>
      <div className="battle-line"></div>
      <div className="battle-text-container">
        <h1 className="battle-text">{text}</h1>
      </div>
    </div>
  );
};