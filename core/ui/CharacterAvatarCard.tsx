import React from 'react';

export type CharacterAvatarCardProps = {
  displayName: string;
  imageSrc?: string;
  size?: number;
  borderRadius?: number;
  borderColor?: string;
  glowColor?: string;
  background?: string;
  textColor?: string;
  fontSize?: number;
  className?: string;
  style?: React.CSSProperties;
};

const pickInitials = (displayName: string): string => {
  const trimmed = displayName.trim();
  if (!trimmed) return '?';

  // CJK 名称直接取前两字，其他名称取前两个有效字符。
  const cjkMatch = trimmed.match(/[\u4E00-\u9FFF]/g);
  if (cjkMatch && cjkMatch.length > 0) {
    return cjkMatch.slice(0, 2).join('');
  }

  const normalized = trimmed.replace(/\s+/g, '');
  return normalized.slice(0, 2).toUpperCase();
};

export const CharacterAvatarCard: React.FC<CharacterAvatarCardProps> = ({
  displayName,
  imageSrc,
  size = 156,
  borderRadius = 10,
  borderColor = 'rgba(134, 239, 172, 0.72)',
  glowColor = 'rgba(74, 222, 128, 0.28)',
  background = 'linear-gradient(145deg, rgba(52, 211, 153, 0.95) 0%, rgba(22, 101, 52, 0.9) 62%, rgba(4, 30, 18, 0.96) 100%)',
  textColor = '#ecfdf5',
  fontSize = 42,
  className,
  style
}) => {
  const initials = pickInitials(displayName);

  return (
    <div
      className={className}
      style={{
        width: size,
        height: size,
        borderRadius,
        border: `2px solid ${borderColor}`,
        boxShadow: `0 0 24px ${glowColor}`,
        overflow: 'hidden',
        position: 'relative',
        background,
        color: textColor,
        display: 'grid',
        placeItems: 'center',
        fontSize,
        fontWeight: 700,
        letterSpacing: 2,
        userSelect: 'none',
        ...style
      }}
    >
      {imageSrc ? (
        <img
          src={imageSrc}
          alt={displayName}
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        />
      ) : (
        <span>{initials}</span>
      )}
    </div>
  );
};
