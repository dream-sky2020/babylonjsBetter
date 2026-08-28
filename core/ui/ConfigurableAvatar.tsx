import React from 'react';
import type { AvatarExpressionConfig, ResolvedAvatarAtlasFrame } from './ConfigurableAvatar.types';
import { resolveAppAssetUrl } from '@/core/resources/appAssetUrl.ts';

export type ConfigurableAvatarProps = Omit<React.HTMLAttributes<HTMLDivElement>, 'children'> & {
  expression?: AvatarExpressionConfig;
  atlasFrame?: ResolvedAvatarAtlasFrame;
  alt?: string;
  fallbackText?: string;
  children?: React.ReactNode;
};

const toPublicImageUrl = (imagePath: string): string => resolveAppAssetUrl(imagePath);

export const ConfigurableAvatar: React.FC<ConfigurableAvatarProps> = ({
  expression,
  atlasFrame,
  alt,
  fallbackText = '?',
  style,
  children,
  ...elementProps
}) => {
  const imageUrl = expression?.imagePath ? toPublicImageUrl(expression.imagePath) : '';
  const content = imageUrl && expression ? (atlasFrame ? (
    <img
      src={imageUrl}
      alt={alt ?? expression.name}
      draggable={false}
      style={{
        position: 'absolute',
        width: `${atlasFrame.atlasSize.w / atlasFrame.frame.w * 100 * expression.scale}%`,
        height: `${atlasFrame.atlasSize.h / atlasFrame.frame.h * 100 * expression.scale}%`,
        maxWidth: 'none',
        left: `calc(${-atlasFrame.frame.x / atlasFrame.frame.w * 100}% + ${expression.offsetX}px)`,
        top: `calc(${-atlasFrame.frame.y / atlasFrame.frame.h * 100}% + ${expression.offsetY}px)`,
        userSelect: 'none',
        pointerEvents: 'none'
      }}
    />
  ) : (
    <img
      src={imageUrl}
      alt={alt ?? expression.name}
      draggable={false}
      style={{
        width: '100%',
        height: '100%',
        objectFit: 'cover',
        transform: `translate(${expression.offsetX}px, ${expression.offsetY}px) scale(${expression.scale})`,
        userSelect: 'none',
        pointerEvents: 'none'
      }}
    />
  )) : (
    <div style={{ width: '100%', height: '100%', display: 'grid', placeItems: 'center', fontSize: 42 }}>{fallbackText}</div>
  );

  return (
    <div
      {...elementProps}
      style={{
        width: '100%',
        height: '100%',
        position: 'relative',
        ...style
      }}
    >
      {content}
      {children}
    </div>
  );
};
