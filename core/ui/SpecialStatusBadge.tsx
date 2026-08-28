import React from 'react';
import { resolveAppAssetUrl } from '@/core/resources/appAssetUrl.ts';

export type SpecialStatusBadgeProps = {
  iconSrc?: string;
  topLeftValue?: number | string;
  topRightValue?: number | string;
  bottomLeftValue?: number | string;
  bottomRightValue?: number | string;
  showTopLeftValue?: boolean;
  showTopRightValue?: boolean;
  showBottomLeftValue?: boolean;
  showBottomRightValue?: boolean;
  /**
   * @deprecated 请改用 topLeftValue
   */
  topValue?: number | string;
  /**
   * @deprecated 请改用 bottomRightValue
   */
  bottomValue?: number | string;
  size?: number;
  iconScale?: number;
  textColor?: string;
  valueFontSize?: number;
  squareInset?: number | string;
  /**
   * @deprecated 请使用 squareInset（支持百分比）
   */
  cornerInset?: number;
  className?: string;
  style?: React.CSSProperties;
};

export const SpecialStatusBadge: React.FC<SpecialStatusBadgeProps> = ({
  iconSrc,
  topLeftValue,
  topRightValue,
  bottomLeftValue,
  bottomRightValue,
  showTopLeftValue = true,
  showTopRightValue = true,
  showBottomLeftValue = true,
  showBottomRightValue = true,
  topValue,
  bottomValue,
  size = 96,
  iconScale = 1,
  textColor = '#e2e8f0',
  valueFontSize = 14,
  squareInset = '15%',
  cornerInset,
  className,
  style
}) => {
  const cornerValueStyle: React.CSSProperties = {
    color: textColor,
    lineHeight: 1,
    fontWeight: 700,
    userSelect: 'none',
    fontSize: valueFontSize,
    whiteSpace: 'nowrap'
  };
  const resolvedInset = cornerInset ?? squareInset;
  const resolvedTopLeft = topLeftValue ?? topValue ?? '';
  const resolvedTopRight = topRightValue ?? topValue ?? '';
  const resolvedBottomLeft = bottomLeftValue ?? bottomValue ?? '';
  const resolvedBottomRight = bottomRightValue ?? bottomValue ?? '';

  return (
    <div
      className={className}
      style={{
        width: size,
        height: size,
        borderRadius: 0,
        position: 'relative',
        overflow: 'hidden',
        boxSizing: 'border-box',
        ...style
      }}
    >
      {iconSrc ? (
        <img
          src={resolveAppAssetUrl(iconSrc)}
          alt="status icon"
          style={{
            position: 'absolute',
            left: '50%',
            top: '50%',
            width: `${iconScale * 100}%`,
            height: `${iconScale * 100}%`,
            transform: 'translate(-50%, -50%)',
            objectFit: 'cover',
            display: 'block'
          }}
        />
      ) : null}

      <div
        style={{
          position: 'absolute',
          inset: resolvedInset,
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gridTemplateRows: '1fr 1fr',
          placeItems: 'center',
          pointerEvents: 'none'
        }}
      >
        {showTopLeftValue ? (
          <span style={{ ...cornerValueStyle, gridColumn: 1, gridRow: 1 }}>
            {resolvedTopLeft}
          </span>
        ) : null}
        {showTopRightValue ? (
          <span style={{ ...cornerValueStyle, gridColumn: 2, gridRow: 1 }}>
            {resolvedTopRight}
          </span>
        ) : null}
        {showBottomLeftValue ? (
          <span style={{ ...cornerValueStyle, gridColumn: 1, gridRow: 2 }}>
            {resolvedBottomLeft}
          </span>
        ) : null}
        {showBottomRightValue ? (
          <span style={{ ...cornerValueStyle, gridColumn: 2, gridRow: 2 }}>
            {resolvedBottomRight}
          </span>
        ) : null}
      </div>
    </div>
  );
};
