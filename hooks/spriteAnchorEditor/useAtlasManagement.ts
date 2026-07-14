import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  getLocalSpriteAnchorPreset,
  getSpriteAnchorPreset,
  parseSpritePresetKey,
  toSpritePresetKey,
  DEFAULT_ATLAS_JSON_PATH,
  DEFAULT_SCANNED_ATLAS_OPTIONS,
  RESOURCE_IMAGE_MODULES,
  getLastAtlasJsonPath,
  getLastEditorMode,
  joinPublicPath,
  normalizePublicPath,
  saveLastAtlasJsonPath,
  saveLastEditorMode,
  toFrameRegion,
  type TexturePackerAtlas,
  type SpriteAnchorPreset,
  type SpriteFrameRegion
} from '@/core/sprite';

type AtlasFrameRegion = SpriteFrameRegion & { atlasPath: string; atlasImagePath: string };

interface UseAtlasManagementParams {
  initialImagePath: string;
  presetKeys: string[];
  applyPresetBySelection: (nextImagePath: string, nextFrameName?: string, nextAtlasFrame?: SpriteAnchorPreset['atlasFrame']) => void;
  setMessage: React.Dispatch<React.SetStateAction<string>>;
}

interface UseAtlasManagementResult {
  imagePath: string;
  mode: 'single' | 'atlas';
  atlasJsonPath: string;
  atlasImagePath: string;
  atlasData: TexturePackerAtlas | null;
  frameNames: string[];
  selectedFrameName: string;
  scannedAtlasOptions: string[];
  resourceImageOptions: string[];
  allPresetKeys: string[];
  normalizedImagePath: string;
  activeImagePath: string;
  activeFrameName?: string;
  activePresetKey: string;
  currentFrameRegion: AtlasFrameRegion | null;
  setMode: React.Dispatch<React.SetStateAction<'single' | 'atlas'>>;
  setAtlasJsonPath: React.Dispatch<React.SetStateAction<string>>;
  loadAtlas: (nextAtlasPath: string, preferredFrameName?: string) => Promise<void>;
  handleSpriteResourceChange: (nextImagePath: string, nextFrameName?: string, nextAtlasFrame?: SpriteAnchorPreset['atlasFrame']) => void;
  handlePresetSelectionChange: (selectedKey: string) => Promise<void>;
  handleAtlasFrameSelectChange: (nextFrameName: string) => void;
}

export const useAtlasManagement = ({
  initialImagePath,
  presetKeys,
  applyPresetBySelection,
  setMessage
}: UseAtlasManagementParams): UseAtlasManagementResult => {
  const [imagePath, setImagePath] = useState(initialImagePath);
  const [mode, setMode] = useState<'single' | 'atlas'>(() => getLastEditorMode() ?? 'atlas');
  const [atlasJsonPath, setAtlasJsonPath] = useState(() => {
    const saved = getLastAtlasJsonPath();
    if (saved) return saved;
    return DEFAULT_SCANNED_ATLAS_OPTIONS.length > 0 ? DEFAULT_SCANNED_ATLAS_OPTIONS[0] : DEFAULT_ATLAS_JSON_PATH;
  });
  const [atlasImagePath, setAtlasImagePath] = useState('');
  const [atlasData, setAtlasData] = useState<TexturePackerAtlas | null>(null);
  const [frameNames, setFrameNames] = useState<string[]>([]);
  const [selectedFrameName, setSelectedFrameName] = useState('');

  const activeImagePath = mode === 'atlas' ? atlasImagePath : imagePath;
  const activeFrameName = mode === 'atlas' ? selectedFrameName || undefined : undefined;
  const activePresetKey = toSpritePresetKey(activeImagePath || imagePath, activeFrameName);
  const normalizedImagePath = toSpritePresetKey(imagePath);

  const scannedResourceImages = useMemo(() => {
    return Object.values(RESOURCE_IMAGE_MODULES)
      .map((assetUrl) => toSpritePresetKey(assetUrl))
      .sort();
  }, []);

  const scannedAtlasOptions = useMemo(() => DEFAULT_SCANNED_ATLAS_OPTIONS, []);

  const resourceImageOptions = useMemo(() => {
    const parsedPresetImageKeys = presetKeys.map((key) => parseSpritePresetKey(key).imagePath);
    const merged = new Set<string>([...scannedResourceImages, ...parsedPresetImageKeys, normalizedImagePath]);
    return [...merged].sort((a, b) => a.localeCompare(b, 'zh-CN'));
  }, [presetKeys, scannedResourceImages, normalizedImagePath]);

  const allPresetKeys = useMemo(() => {
    const unique = new Set<string>([...presetKeys, activePresetKey, normalizedImagePath]);
    return [...unique].sort((a, b) => a.localeCompare(b, 'zh-CN'));
  }, [presetKeys, normalizedImagePath, activePresetKey]);

  const currentFrameRegion = useMemo<AtlasFrameRegion | null>(() => {
    if (mode !== 'atlas') return null;
    if (!atlasData || !selectedFrameName || !atlasImagePath) return null;
    const frame = atlasData.frames[selectedFrameName];
    if (!frame) return null;
    return toFrameRegion(atlasJsonPath, atlasImagePath, selectedFrameName, frame, atlasData.meta.size);
  }, [mode, atlasData, selectedFrameName, atlasImagePath, atlasJsonPath]);

  const loadAtlas = useCallback(async (nextAtlasPath: string, preferredFrameName?: string) => {
    const normalizedAtlasPath = normalizePublicPath(nextAtlasPath);
    if (!normalizedAtlasPath) return;
    try {
      const response = await fetch(encodeURI(`/${normalizedAtlasPath}`));
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const atlasJson = await response.json() as TexturePackerAtlas;
      const names = Object.keys(atlasJson.frames).sort((a, b) => a.localeCompare(b, 'zh-CN'));
      if (names.length === 0) throw new Error('图集没有可用帧');
      const resolvedImagePath = joinPublicPath(normalizedAtlasPath, atlasJson.meta.image);
      const resolvedFrameName = (preferredFrameName && atlasJson.frames[preferredFrameName]) ? preferredFrameName : names[0];
      const resolvedFrame = toFrameRegion(
        normalizedAtlasPath,
        resolvedImagePath,
        resolvedFrameName,
        atlasJson.frames[resolvedFrameName],
        atlasJson.meta.size
      );
      setAtlasJsonPath(normalizedAtlasPath);
      setAtlasData(atlasJson);
      setAtlasImagePath(resolvedImagePath);
      setFrameNames(names);
      setSelectedFrameName(resolvedFrameName);
      setMode('atlas');
      applyPresetBySelection(resolvedImagePath, resolvedFrameName, {
        atlasPath: normalizedAtlasPath,
        frameName: resolvedFrameName,
        frame: resolvedFrame.frame,
        spriteSourceSize: resolvedFrame.spriteSourceSize,
        sourceSize: resolvedFrame.sourceSize,
        atlasSize: resolvedFrame.atlasSize,
        rotated: resolvedFrame.rotated,
        trimmed: resolvedFrame.trimmed
      });
      setMessage(`图集加载成功：${normalizedAtlasPath}`);
    } catch (error) {
      setAtlasData(null);
      setFrameNames([]);
      setSelectedFrameName('');
      setMessage(`图集加载失败：${normalizedAtlasPath} (${String(error)})`);
    }
  }, [applyPresetBySelection, setMessage]);

  const handleSpriteResourceChange = useCallback((
    nextImagePath: string,
    nextFrameName?: string,
    nextAtlasFrame?: SpriteAnchorPreset['atlasFrame']
  ) => {
    if (nextFrameName) {
      setMode('atlas');
      setAtlasImagePath(nextImagePath);
      setSelectedFrameName(nextFrameName);
    } else {
      setMode('single');
      setImagePath(nextImagePath);
    }
    applyPresetBySelection(nextImagePath, nextFrameName, nextAtlasFrame);
  }, [applyPresetBySelection]);

  const handlePresetSelectionChange = useCallback(async (selectedKey: string) => {
    if (!selectedKey) return;
    const localPreset = getLocalSpriteAnchorPreset(selectedKey);
    const targetPreset = localPreset ?? getSpriteAnchorPreset(selectedKey);
    const parsed = parseSpritePresetKey(selectedKey);
    const resolvedImagePath = targetPreset.imagePath || parsed.imagePath;
    const resolvedFrameName = targetPreset.frameName ?? parsed.frameName;

    if (!resolvedFrameName) {
      handleSpriteResourceChange(resolvedImagePath);
      return;
    }

    const atlasPath = targetPreset.atlasFrame?.atlasPath;
    if (atlasPath) {
      await loadAtlas(atlasPath, resolvedFrameName);
      return;
    }

    handleSpriteResourceChange(resolvedImagePath, resolvedFrameName, targetPreset.atlasFrame);
  }, [handleSpriteResourceChange, loadAtlas]);

  const handleAtlasFrameSelectChange = useCallback((nextFrameName: string) => {
    setSelectedFrameName(nextFrameName);
    if (!atlasData || !atlasImagePath) return;
    const nextFrame = atlasData.frames[nextFrameName];
    if (!nextFrame) return;
    const nextFrameRegion = toFrameRegion(atlasJsonPath, atlasImagePath, nextFrameName, nextFrame, atlasData.meta.size);
    handleSpriteResourceChange(atlasImagePath, nextFrameName, {
      atlasPath: atlasJsonPath,
      frameName: nextFrameName,
      frame: nextFrameRegion.frame,
      spriteSourceSize: nextFrameRegion.spriteSourceSize,
      sourceSize: nextFrameRegion.sourceSize,
      atlasSize: nextFrameRegion.atlasSize,
      rotated: nextFrameRegion.rotated,
      trimmed: nextFrameRegion.trimmed
    });
  }, [atlasData, atlasImagePath, atlasJsonPath, handleSpriteResourceChange]);

  useEffect(() => {
    saveLastAtlasJsonPath(atlasJsonPath);
  }, [atlasJsonPath]);

  useEffect(() => {
    saveLastEditorMode(mode);
  }, [mode]);

  return {
    imagePath,
    mode,
    atlasJsonPath,
    atlasImagePath,
    atlasData,
    frameNames,
    selectedFrameName,
    scannedAtlasOptions,
    resourceImageOptions,
    allPresetKeys,
    normalizedImagePath,
    activeImagePath,
    activeFrameName,
    activePresetKey,
    currentFrameRegion,
    setMode,
    setAtlasJsonPath,
    loadAtlas,
    handleSpriteResourceChange,
    handlePresetSelectionChange,
    handleAtlasFrameSelectChange
  };
};
