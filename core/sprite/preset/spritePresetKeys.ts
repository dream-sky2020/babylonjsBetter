const PRESET_KEY_SEPARATOR = '::';

export const normalizeTexturePath = (texturePath: string): string => {
  const cleaned = texturePath.split('?')[0].split('#')[0];
  const decoded = decodeURI(cleaned);
  return decoded.replace(/^\/+/, '');
};

export const parseSpritePresetKey = (
  texturePathOrPresetKey: string
): { imagePath: string; frameName?: string } => {
  const normalized = normalizeTexturePath(texturePathOrPresetKey);
  const separatorIndex = normalized.indexOf(PRESET_KEY_SEPARATOR);
  if (separatorIndex < 0) return { imagePath: normalized };
  const imagePath = normalized.slice(0, separatorIndex);
  const frameName = normalized.slice(separatorIndex + PRESET_KEY_SEPARATOR.length) || undefined;
  return { imagePath, frameName };
};

export const toSpritePresetKey = (texturePath: string, frameName?: string): string => {
  const normalizedPath = normalizeTexturePath(texturePath);
  return frameName ? `${normalizedPath}${PRESET_KEY_SEPARATOR}${frameName}` : normalizedPath;
};

export const resolvePresetIdentity = (
  texturePathOrPresetKey: string,
  frameName?: string
): { imagePath: string; frameName?: string; presetKey: string } => {
  const parsed = parseSpritePresetKey(texturePathOrPresetKey);
  const finalFrameName = frameName ?? parsed.frameName;
  const imagePath = parsed.imagePath;
  return {
    imagePath,
    frameName: finalFrameName,
    presetKey: toSpritePresetKey(imagePath, finalFrameName)
  };
};
