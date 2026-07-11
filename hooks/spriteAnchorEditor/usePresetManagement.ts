import { useCallback, useEffect, useRef, useState } from 'react';
import type { SpriteAnchorPreset } from '@app-types/sprite-anchors.types';
import {
  hydrateSpriteAnchorPresetStorage,
  getAllSpriteAnchorPresets,
  getLocalSpriteAnchorPreset,
  removeSpriteAnchorPreset,
  saveSpriteAnchorPreset
} from '../../utils/spritePresetStorage';
import {
  ANCHOR_MAX,
  ANCHOR_MIN,
  BOUNDS_MAX,
  BOUNDS_MIN,
  clamp,
  clamp01,
  createEditablePreset,
  getPresetSourceLabel,
  toFixedNumber
} from '../../utils/spriteAnchorEditorHelpers';
import type { SpriteFrameRegion } from '../../utils/meshFactory';
import type { DragTarget } from '../../utils/spriteAnchorEditorHelpers';

type AtlasFrameRegion = SpriteFrameRegion & { atlasPath: string; atlasImagePath: string };

interface UsePresetManagementParams {
  initialImagePath: string;
}

interface UsePresetManagementResult {
  preset: SpriteAnchorPreset;
  presetRef: React.MutableRefObject<SpriteAnchorPreset>;
  message: string;
  presetSourceLabel: string;
  presetKeys: string[];
  setMessage: React.Dispatch<React.SetStateAction<string>>;
  setPresetSourceLabel: React.Dispatch<React.SetStateAction<string>>;
  setPreset: React.Dispatch<React.SetStateAction<SpriteAnchorPreset>>;
  applyPresetBySelection: (nextImagePath: string, nextFrameName?: string, nextAtlasFrame?: SpriteAnchorPreset['atlasFrame']) => void;
  updatePresetByDrag: (target: Exclude<DragTarget, null>, u: number, v: number) => void;
  updatePresetField: (path: string, rawValue: string) => void;
  importCurrentLocalPreset: (
    activePresetKey: string,
    activeImagePath: string,
    imagePath: string,
    activeFrameName?: string
  ) => void;
  saveCurrentPreset: (
    activePresetKey: string,
    activeImagePath: string,
    imagePath: string,
    activeFrameName?: string
  ) => void;
  clearCurrentPreset: (
    activePresetKey: string,
    activeImagePath: string,
    imagePath: string,
    activeFrameName?: string,
    currentFrameRegion?: AtlasFrameRegion | null
  ) => void;
  exportJson: () => void;
}

export const usePresetManagement = ({ initialImagePath }: UsePresetManagementParams): UsePresetManagementResult => {
  const [preset, setPreset] = useState<SpriteAnchorPreset>(() => createEditablePreset(initialImagePath));
  const presetRef = useRef<SpriteAnchorPreset>(createEditablePreset(initialImagePath));
  const [message, setMessage] = useState('');
  const [presetSourceLabel, setPresetSourceLabel] = useState('当前配置来源：项目默认/内置');
  const [presetKeys, setPresetKeys] = useState<string[]>(() => Object.keys(getAllSpriteAnchorPresets()).sort());

  useEffect(() => {
    presetRef.current = preset;
  }, [preset]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      await hydrateSpriteAnchorPresetStorage();
      if (cancelled) return;
      setPresetKeys(Object.keys(getAllSpriteAnchorPresets()).sort());
      setPreset((prev) => {
        const refreshed = createEditablePreset(prev.imagePath, prev.frameName, prev.atlasFrame);
        setPresetSourceLabel(getPresetSourceLabel(refreshed.presetKey));
        return refreshed;
      });
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const applyPresetBySelection = useCallback((
    nextImagePath: string,
    nextFrameName?: string,
    nextAtlasFrame?: SpriteAnchorPreset['atlasFrame']
  ) => {
    const nextPreset = createEditablePreset(nextImagePath, nextFrameName, nextAtlasFrame);
    setPreset(nextPreset);
    setPresetSourceLabel(getPresetSourceLabel(nextPreset.presetKey));
  }, []);

  const updatePresetByDrag = useCallback((target: Exclude<DragTarget, null>, u: number, v: number) => {
    const clampedU = toFixedNumber(clamp01(u));
    const clampedV = toFixedNumber(clamp01(v));
    setPreset((prev) => {
      if (target === 'axis') return { ...prev, bodyAxisX: clampedU };
      return {
        ...prev,
        anchors: {
          ...prev.anchors,
          [target]: { u: clampedU, v: clampedV }
        }
      };
    });
  }, []);

  const updatePresetField = useCallback((path: string, rawValue: string) => {
    const parsedValue = Number(rawValue);
    if (Number.isNaN(parsedValue)) return;
    const value = (() => {
      switch (path) {
        case 'head.u':
        case 'head.v':
        case 'foot.u':
        case 'foot.v':
        case 'center.u':
        case 'center.v':
        case 'bodyAxisX':
          return clamp(parsedValue, ANCHOR_MIN, ANCHOR_MAX);
        case 'minU':
        case 'maxU':
        case 'minV':
        case 'maxV':
          return clamp(parsedValue, BOUNDS_MIN, BOUNDS_MAX);
        default:
          return parsedValue;
      }
    })();

    setPreset((prev) => {
      switch (path) {
        case 'bodyAxisX':
          return { ...prev, bodyAxisX: toFixedNumber(value) };
        case 'head.u':
          return { ...prev, anchors: { ...prev.anchors, head: { ...prev.anchors.head, u: toFixedNumber(value) } } };
        case 'head.v':
          return { ...prev, anchors: { ...prev.anchors, head: { ...prev.anchors.head, v: toFixedNumber(value) } } };
        case 'foot.u':
          return { ...prev, anchors: { ...prev.anchors, foot: { ...prev.anchors.foot, u: toFixedNumber(value) } } };
        case 'foot.v':
          return { ...prev, anchors: { ...prev.anchors, foot: { ...prev.anchors.foot, v: toFixedNumber(value) } } };
        case 'center.u':
          return { ...prev, anchors: { ...prev.anchors, center: { ...prev.anchors.center, u: toFixedNumber(value) } } };
        case 'center.v':
          return { ...prev, anchors: { ...prev.anchors, center: { ...prev.anchors.center, v: toFixedNumber(value) } } };
        case 'minU':
          return { ...prev, bodyBounds: { ...prev.bodyBounds, minU: toFixedNumber(value) } };
        case 'maxU':
          return { ...prev, bodyBounds: { ...prev.bodyBounds, maxU: toFixedNumber(value) } };
        case 'minV':
          return { ...prev, bodyBounds: { ...prev.bodyBounds, minV: toFixedNumber(value) } };
        case 'maxV':
          return { ...prev, bodyBounds: { ...prev.bodyBounds, maxV: toFixedNumber(value) } };
        default:
          return prev;
      }
    });
  }, []);

  const importCurrentLocalPreset = useCallback((
    activePresetKey: string,
    activeImagePath: string,
    imagePath: string,
    activeFrameName?: string
  ) => {
    const localPreset = getLocalSpriteAnchorPreset(activePresetKey);
    if (!localPreset) {
      setMessage(`该资源暂无本地配置：${activePresetKey}`);
      return;
    }
    setPreset({
      ...localPreset,
      presetKey: activePresetKey,
      imagePath: activeImagePath || imagePath,
      frameName: activeFrameName
    });
    setPresetSourceLabel('当前配置来源：本地配置（手动导入）');
    setMessage(`已导入本地配置：${activePresetKey}`);
  }, []);

  const saveCurrentPreset = useCallback((
    activePresetKey: string,
    activeImagePath: string,
    imagePath: string,
    activeFrameName?: string
  ) => {
    const saveImagePath = activeImagePath || imagePath;
    if (!saveImagePath) {
      setMessage('资源路径不能为空，无法保存配置');
      return;
    }
    saveSpriteAnchorPreset({
      ...preset,
      presetKey: activePresetKey,
      imagePath: saveImagePath,
      frameName: activeFrameName
    });
    setPresetKeys(Object.keys(getAllSpriteAnchorPresets()).sort());
    setPresetSourceLabel('当前配置来源：本地配置（已保存）');
    setMessage(`已保存: ${activePresetKey}`);
  }, [preset]);

  const clearCurrentPreset = useCallback((
    activePresetKey: string,
    activeImagePath: string,
    imagePath: string,
    activeFrameName?: string,
    currentFrameRegion?: AtlasFrameRegion | null
  ) => {
    const clearImagePath = activeImagePath || imagePath;
    removeSpriteAnchorPreset(activePresetKey);
    setPreset(createEditablePreset(clearImagePath, activeFrameName, currentFrameRegion ? {
      atlasPath: currentFrameRegion.atlasPath,
      frameName: currentFrameRegion.frameName || '',
      frame: currentFrameRegion.frame,
      spriteSourceSize: currentFrameRegion.spriteSourceSize,
      sourceSize: currentFrameRegion.sourceSize,
      atlasSize: currentFrameRegion.atlasSize,
      rotated: currentFrameRegion.rotated,
      trimmed: currentFrameRegion.trimmed
    } : undefined));
    setPresetKeys(Object.keys(getAllSpriteAnchorPresets()).sort());
    setPresetSourceLabel('当前配置来源：项目默认/内置');
    setMessage(`已清除本地覆盖: ${activePresetKey}`);
  }, []);

  const exportJson = useCallback(() => {
    const all = getAllSpriteAnchorPresets();
    const blob = new Blob([JSON.stringify(all, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'sprite-anchor-presets.json';
    anchor.click();
    URL.revokeObjectURL(url);
    setMessage('已导出 JSON');
  }, []);

  return {
    preset,
    presetRef,
    message,
    presetSourceLabel,
    presetKeys,
    setMessage,
    setPresetSourceLabel,
    setPreset,
    applyPresetBySelection,
    updatePresetByDrag,
    updatePresetField,
    importCurrentLocalPreset,
    saveCurrentPreset,
    clearCurrentPreset,
    exportJson
  };
};
