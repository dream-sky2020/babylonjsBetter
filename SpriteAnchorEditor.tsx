import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArcRotateCamera, Color4, Engine, HemisphericLight, Scene, Vector3 } from '@babylonjs/core';
import type { SpriteAnchorPreset } from '@app-types/sprite-anchors.types';
import {
  getAllSpriteAnchorPresets,
  getLocalSpriteAnchorPreset,
  getSpriteAnchorPreset,
  hasLocalSpriteAnchorPreset,
  parseSpritePresetKey,
  removeSpriteAnchorPreset,
  saveSpriteAnchorPreset,
  toSpritePresetKey
} from './utils/spritePresetStorage';
import { createMockSprite, drawSpriteDebugHelper } from './utils/mockSprite';
import type { MockSprite } from './utils/mockSprite';
import type { SpriteFrameRegion } from './utils/meshFactory';

type DragTarget = 'head' | 'foot' | 'center' | 'axis' | null;

const normalizePublicPath = (input: string): string => {
  return decodeURI(input).replace(/^\/+/, '').replace(/^\.\/+/, '');
};

const RESOURCE_IMAGE_MODULES = import.meta.glob('/public/**/*.{png,jpg,jpeg,webp,gif,avif,svg}', {
  eager: true,
  query: '?url',
  import: 'default'
}) as Record<string, string>;
const RESOURCE_ATLAS_PATHS = Object.keys(import.meta.glob('/public/**/*.json'));
const DEFAULT_SCANNED_ATLAS_OPTIONS = RESOURCE_ATLAS_PATHS
  .map((path) => normalizePublicPath(path).replace(/^public\/+/, ''))
  .sort((a, b) => a.localeCompare(b, 'zh-CN'));
const LAST_ATLAS_JSON_STORAGE_KEY = 'sprite-anchor-editor.last-atlas-json-path';
const LAST_EDITOR_MODE_STORAGE_KEY = 'sprite-anchor-editor.last-mode';

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));
const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value));
const DEFAULT_ORTHO_SIZE = 5;
const MIN_ORTHO_SIZE = 1.5;
const MAX_ORTHO_SIZE = 14;
const ZOOM_STEP = 0.1;
const DRAG_HIT_RADIUS_UV = 0.05;
const DEFAULT_ATLAS_JSON_PATH = '君主宝(默认).json';

type TexturePackerFrameRaw = {
  frame: { x: number; y: number; w: number; h: number };
  rotated: boolean;
  trimmed: boolean;
  spriteSourceSize: { x: number; y: number; w: number; h: number };
  sourceSize: { w: number; h: number };
};

type TexturePackerAtlas = {
  frames: Record<string, TexturePackerFrameRaw>;
  meta: {
    image: string;
    size: { w: number; h: number };
  };
};

const joinPublicPath = (basePath: string, relativeOrAbsolutePath: string): string => {
  const normalizedInput = normalizePublicPath(relativeOrAbsolutePath);
  if (normalizedInput.includes('/')) return normalizedInput;
  const normalizedBase = normalizePublicPath(basePath);
  const slashIndex = normalizedBase.lastIndexOf('/');
  if (slashIndex < 0) return normalizedInput;
  return `${normalizedBase.slice(0, slashIndex + 1)}${normalizedInput}`;
};

const getLastAtlasJsonPath = (): string | null => {
  if (typeof window === 'undefined') return null;
  try {
    const saved = window.localStorage.getItem(LAST_ATLAS_JSON_STORAGE_KEY);
    if (!saved) return null;
    return normalizePublicPath(saved);
  } catch {
    return null;
  }
};

const saveLastAtlasJsonPath = (atlasJsonPath: string): void => {
  if (typeof window === 'undefined') return;
  try {
    const normalized = normalizePublicPath(atlasJsonPath);
    if (!normalized) return;
    window.localStorage.setItem(LAST_ATLAS_JSON_STORAGE_KEY, normalized);
  } catch {
    // ignore storage errors
  }
};

const getLastEditorMode = (): 'single' | 'atlas' | null => {
  if (typeof window === 'undefined') return null;
  try {
    const saved = window.localStorage.getItem(LAST_EDITOR_MODE_STORAGE_KEY);
    if (saved === 'single' || saved === 'atlas') return saved;
    return null;
  } catch {
    return null;
  }
};

const saveLastEditorMode = (mode: 'single' | 'atlas'): void => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(LAST_EDITOR_MODE_STORAGE_KEY, mode);
  } catch {
    // ignore storage errors
  }
};

const toFrameRegion = (
  atlasPath: string,
  atlasImagePath: string,
  frameName: string,
  frame: TexturePackerFrameRaw,
  atlasSize: { w: number; h: number }
): SpriteFrameRegion & { atlasPath: string; atlasImagePath: string } => {
  return {
    atlasPath,
    atlasImagePath,
    frameName,
    frame: {
      x: frame.frame.x,
      y: frame.frame.y,
      w: frame.frame.w,
      h: frame.frame.h
    },
    spriteSourceSize: {
      x: frame.spriteSourceSize.x,
      y: frame.spriteSourceSize.y,
      w: frame.spriteSourceSize.w,
      h: frame.spriteSourceSize.h
    },
    sourceSize: {
      w: frame.sourceSize.w,
      h: frame.sourceSize.h
    },
    atlasSize: {
      w: atlasSize.w,
      h: atlasSize.h
    },
    rotated: frame.rotated,
    trimmed: frame.trimmed
  };
};

const createEditablePreset = (
  imagePath: string,
  frameName?: string,
  atlasFrame?: SpriteAnchorPreset['atlasFrame']
): SpriteAnchorPreset => {
  const presetKey = toSpritePresetKey(imagePath, frameName);
  const localPreset = getLocalSpriteAnchorPreset(presetKey);
  if (localPreset) return { ...localPreset, presetKey, imagePath, frameName, atlasFrame: atlasFrame ?? localPreset.atlasFrame };
  const mergedPreset = getSpriteAnchorPreset(presetKey);
  return { ...mergedPreset, presetKey, imagePath, frameName, atlasFrame: atlasFrame ?? mergedPreset.atlasFrame };
};

const toFixedNumber = (value: number): number => Number(value.toFixed(4));
const INPUT_STEP = 0.0001;
const ANCHOR_MIN = -1;
const ANCHOR_MAX = 2;
const BOUNDS_MIN = 0;
const BOUNDS_MAX = 1;

export const SpriteAnchorEditor: React.FC = () => {
  const initialImagePath = 'resources/优势.png';
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<Scene | null>(null);
  const spriteRef = useRef<MockSprite | null>(null);
  const debugMeshesRef = useRef<ReturnType<typeof drawSpriteDebugHelper>>([]);
  const draggingRef = useRef<DragTarget>(null);
  const isPanningRef = useRef(false);
  const lastPointerRef = useRef({ x: 0, y: 0 });
  const orthoSizeRef = useRef(DEFAULT_ORTHO_SIZE);
  const resetViewRef = useRef<(() => void) | null>(null);
  const presetRef = useRef<SpriteAnchorPreset>(createEditablePreset(initialImagePath));

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
  const [preset, setPreset] = useState<SpriteAnchorPreset>(() => createEditablePreset(initialImagePath));
  const [message, setMessage] = useState('');
  const [presetSourceLabel, setPresetSourceLabel] = useState('当前配置来源：项目默认/内置');
  const [presetKeys, setPresetKeys] = useState<string[]>(() => Object.keys(getAllSpriteAnchorPresets()).sort());
  const [zoomLabel, setZoomLabel] = useState('1.00x');
  const activeImagePath = mode === 'atlas' ? atlasImagePath : imagePath;
  const activeFrameName = mode === 'atlas' ? selectedFrameName || undefined : undefined;
  const activePresetKey = toSpritePresetKey(activeImagePath || imagePath, activeFrameName);
  const normalizedImagePath = toSpritePresetKey(imagePath);

  const scannedResourceImages = useMemo(() => {
    return Object.values(RESOURCE_IMAGE_MODULES)
      .map((assetUrl) => toSpritePresetKey(assetUrl))
      .sort();
  }, []);

  const scannedAtlasOptions = useMemo(() => {
    return DEFAULT_SCANNED_ATLAS_OPTIONS;
  }, []);

  const resourceImageOptions = useMemo(() => {
    const parsedPresetImageKeys = presetKeys.map((key) => parseSpritePresetKey(key).imagePath);
    const merged = new Set<string>([...scannedResourceImages, ...parsedPresetImageKeys, normalizedImagePath]);
    return [...merged].sort((a, b) => a.localeCompare(b, 'zh-CN'));
  }, [presetKeys, scannedResourceImages, normalizedImagePath]);

  const allPresetKeys = useMemo(() => {
    const unique = new Set<string>([...presetKeys, activePresetKey, normalizedImagePath]);
    return [...unique].sort((a, b) => a.localeCompare(b, 'zh-CN'));
  }, [presetKeys, normalizedImagePath, activePresetKey]);

  const currentFrameRegion = useMemo<(SpriteFrameRegion & { atlasPath: string; atlasImagePath: string }) | null>(() => {
    if (mode !== 'atlas') return null;
    if (!atlasData || !selectedFrameName || !atlasImagePath) return null;
    const frame = atlasData.frames[selectedFrameName];
    if (!frame) return null;
    return toFrameRegion(atlasJsonPath, atlasImagePath, selectedFrameName, frame, atlasData.meta.size);
  }, [mode, atlasData, selectedFrameName, atlasImagePath, atlasJsonPath]);

  const applyPresetBySelection = useCallback((
    nextImagePath: string,
    nextFrameName?: string,
    nextAtlasFrame?: SpriteAnchorPreset['atlasFrame']
  ) => {
    const nextPreset = createEditablePreset(nextImagePath, nextFrameName, nextAtlasFrame);
    setPreset(nextPreset);
    setPresetSourceLabel(
      hasLocalSpriteAnchorPreset(nextPreset.presetKey)
        ? '当前配置来源：本地配置（已自动导入）'
        : '当前配置来源：项目默认/内置'
    );
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

  const disposeDebugMeshes = useCallback(() => {
    debugMeshesRef.current.forEach((mesh) => mesh.dispose());
    debugMeshesRef.current = [];
  }, []);

  const redrawDebugHelper = useCallback((nextPreset: SpriteAnchorPreset) => {
    const scene = sceneRef.current;
    const sprite = spriteRef.current;
    if (!scene || !sprite) return;
    disposeDebugMeshes();
    const debugMockSprite: MockSprite = { ...sprite, preset: nextPreset };
    debugMeshesRef.current = drawSpriteDebugHelper(debugMockSprite, scene);
  }, [disposeDebugMeshes]);

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
  }, [applyPresetBySelection]);

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
      spriteRef.current?.setFrameRegion(null);
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
    presetRef.current = preset;
    redrawDebugHelper(preset);
  }, [preset, redrawDebugHelper]);

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

  const renderDragNumberControl = (
    label: string,
    path: string,
    value: number,
    min: number,
    max: number,
    description?: string
  ) => (
    <div key={path} style={{ marginBottom: 10, padding: '8px 10px', borderRadius: 8, background: '#141a23' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <span style={{ color: '#9fb0c5', fontSize: 12 }}>{label}</span>
        <span style={{ color: '#cdd6e1', fontSize: 12 }}>{value.toFixed(4)}</span>
      </div>
      {description ? <div style={{ color: '#6f8098', fontSize: 11, marginBottom: 6 }}>{description}</div> : null}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 88px', gap: 8, alignItems: 'center' }}>
        <input
          type="range"
          min={min}
          max={max}
          step={INPUT_STEP}
          value={value}
          onChange={(event) => updatePresetField(path, event.target.value)}
        />
        <input
          type="number"
          step={INPUT_STEP}
          min={min}
          max={max}
          value={value}
          onChange={(event) => updatePresetField(path, event.target.value)}
        />
      </div>
    </div>
  );

  const importCurrentLocalPreset = () => {
    const localPreset = getLocalSpriteAnchorPreset(activePresetKey);
    if (!localPreset) {
      setMessage(`该资源暂无本地配置：${activePresetKey}`);
      return;
    }
    setPreset({ ...localPreset, presetKey: activePresetKey, imagePath: activeImagePath || imagePath, frameName: activeFrameName });
    setPresetSourceLabel('当前配置来源：本地配置（手动导入）');
    setMessage(`已导入本地配置：${activePresetKey}`);
  };

  const saveCurrentPreset = () => {
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
  };

  const clearCurrentPreset = () => {
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
  };

  const exportJson = () => {
    const all = getAllSpriteAnchorPresets();
    const blob = new Blob([JSON.stringify(all, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'sprite-anchor-presets.json';
    anchor.click();
    URL.revokeObjectURL(url);
    setMessage('已导出 JSON');
  };

  // 复制当前锚点与包围盒配置（不包含资源路径等上下文）
  const copyCurrentPreset = useCallback(async () => {
    try {
      const dataToCopy = {
        anchors: preset.anchors,
        bodyBounds: preset.bodyBounds,
        bodyAxisX: preset.bodyAxisX
      };
      await navigator.clipboard.writeText(JSON.stringify(dataToCopy, null, 2));
      setMessage('已将当前锚点与包围盒配置复制到剪贴板');
    } catch (error) {
      setMessage(`复制失败: ${String(error)}`);
    }
  }, [preset]);

  // 从剪贴板读取配置并合并到当前资源
  const pastePreset = useCallback(async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (!text) {
        setMessage('粘贴失败: 剪贴板为空');
        return;
      }

      const parsed = JSON.parse(text) as {
        anchors?: {
          head?: { u?: number; v?: number };
          foot?: { u?: number; v?: number };
          center?: { u?: number; v?: number };
        };
        bodyBounds?: { minU?: number; maxU?: number; minV?: number; maxV?: number };
        bodyAxisX?: number;
      };

      const isValidNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);

      if (
        !parsed.anchors ||
        !parsed.bodyBounds ||
        !isValidNumber(parsed.bodyAxisX) ||
        !isValidNumber(parsed.anchors.head?.u) ||
        !isValidNumber(parsed.anchors.head?.v) ||
        !isValidNumber(parsed.anchors.foot?.u) ||
        !isValidNumber(parsed.anchors.foot?.v) ||
        !isValidNumber(parsed.anchors.center?.u) ||
        !isValidNumber(parsed.anchors.center?.v) ||
        !isValidNumber(parsed.bodyBounds.minU) ||
        !isValidNumber(parsed.bodyBounds.maxU) ||
        !isValidNumber(parsed.bodyBounds.minV) ||
        !isValidNumber(parsed.bodyBounds.maxV)
      ) {
        setMessage('粘贴失败: 剪贴板中的数据不是有效的锚点配置结构');
        return;
      }

      const normalizeBounds = (minValue: number, maxValue: number) => {
        const safeMin = clamp(Math.min(minValue, maxValue), BOUNDS_MIN, BOUNDS_MAX);
        const safeMax = clamp(Math.max(minValue, maxValue), BOUNDS_MIN, BOUNDS_MAX);
        return { min: toFixedNumber(safeMin), max: toFixedNumber(safeMax) };
      };

      const normalizedU = normalizeBounds(parsed.bodyBounds.minU, parsed.bodyBounds.maxU);
      const normalizedV = normalizeBounds(parsed.bodyBounds.minV, parsed.bodyBounds.maxV);
      const safeAnchors = parsed.anchors;
      const safeBodyAxisX = parsed.bodyAxisX;

      setPreset((prev) => ({
        ...prev,
        anchors: {
          head: {
            u: toFixedNumber(clamp(safeAnchors.head!.u!, ANCHOR_MIN, ANCHOR_MAX)),
            v: toFixedNumber(clamp(safeAnchors.head!.v!, ANCHOR_MIN, ANCHOR_MAX))
          },
          foot: {
            u: toFixedNumber(clamp(safeAnchors.foot!.u!, ANCHOR_MIN, ANCHOR_MAX)),
            v: toFixedNumber(clamp(safeAnchors.foot!.v!, ANCHOR_MIN, ANCHOR_MAX))
          },
          center: {
            u: toFixedNumber(clamp(safeAnchors.center!.u!, ANCHOR_MIN, ANCHOR_MAX)),
            v: toFixedNumber(clamp(safeAnchors.center!.v!, ANCHOR_MIN, ANCHOR_MAX))
          }
        },
        bodyBounds: {
          minU: normalizedU.min,
          maxU: normalizedU.max,
          minV: normalizedV.min,
          maxV: normalizedV.max
        },
        bodyAxisX: toFixedNumber(clamp(safeBodyAxisX, ANCHOR_MIN, ANCHOR_MAX))
      }));
      setPresetSourceLabel('当前配置来源：从剪贴板粘贴（未保存）');
      setMessage('已成功粘贴剪贴板配置，请记得保存到本地');
    } catch (error) {
      setMessage(`粘贴失败: ${String(error)}`);
    }
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (!Engine.IsSupported) {
      window.setTimeout(() => {
        setMessage('当前环境不支持 WebGL，无法初始化 Babylon 渲染。请检查浏览器图形加速设置或更换支持 WebGL 的浏览器。');
      }, 0);
      return;
    }

    let engine: Engine;
    try {
      engine = new Engine(canvas, true);
    } catch {
      window.setTimeout(() => {
        setMessage('Babylon 引擎初始化失败：当前环境可能不支持 WebGL。');
      }, 0);
      return;
    }
    const scene = new Scene(engine);
    scene.clearColor = new Color4(0.1, 0.1, 0.15, 1);
    const camera = new ArcRotateCamera('sprite_editor_camera', -Math.PI / 2, Math.PI / 2, 10, Vector3.Zero(), scene);
    camera.lowerAlphaLimit = -Math.PI / 2;
    camera.upperAlphaLimit = -Math.PI / 2;
    camera.lowerBetaLimit = Math.PI / 2;
    camera.upperBetaLimit = Math.PI / 2;
    camera.mode = ArcRotateCamera.ORTHOGRAPHIC_CAMERA;

    const light = new HemisphericLight('sprite_editor_light', new Vector3(0, 1, 0), scene);
    light.intensity = 0.7;

    sceneRef.current = scene;

    const updateOrtho = () => {
      const aspect = engine.getRenderWidth() / Math.max(1, engine.getRenderHeight());
      camera.orthoTop = orthoSizeRef.current;
      camera.orthoBottom = -orthoSizeRef.current;
      camera.orthoLeft = -orthoSizeRef.current * aspect;
      camera.orthoRight = orthoSizeRef.current * aspect;
      setZoomLabel(`${(DEFAULT_ORTHO_SIZE / Math.max(orthoSizeRef.current, 0.001)).toFixed(2)}x`);
    };

    const resetView = () => {
      camera.target.set(0, 0, 0);
      orthoSizeRef.current = DEFAULT_ORTHO_SIZE;
      updateOrtho();
    };
    resetViewRef.current = resetView;
    resetView();

    const toRenderCoords = (event: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      return {
        x: ((event.clientX - rect.left) / Math.max(rect.width, 1)) * engine.getRenderWidth(),
        y: ((event.clientY - rect.top) / Math.max(rect.height, 1)) * engine.getRenderHeight()
      };
    };

    const pickSpriteUv = (event: PointerEvent) => {
      const sprite = spriteRef.current;
      if (!sprite) return null;
      const pos = toRenderCoords(event);
      const pick = scene.pick(pos.x, pos.y, (mesh) => mesh === sprite.mesh, false, camera);
      const uv = pick?.getTextureCoordinates();
      if (!pick?.hit || !uv) return null;
      return { u: clamp01(uv.x), v: clamp01(uv.y) };
    };

    const resolveDragTarget = (u: number, v: number): DragTarget => {
      const current = presetRef.current;
      const anchors = current.anchors;
      const nearest = (Object.keys(anchors) as Array<keyof typeof anchors>)
        .map((key) => {
          const anchor = anchors[key];
          const dist = Math.hypot(anchor.u - u, anchor.v - v);
          return { key, dist };
        })
        .sort((a, b) => a.dist - b.dist)[0];

      if (nearest && nearest.dist <= DRAG_HIT_RADIUS_UV) return nearest.key;
      if (Math.abs(current.bodyAxisX - u) <= DRAG_HIT_RADIUS_UV) return 'axis';
      return null;
    };

    const handlePointerDown = (event: PointerEvent) => {
      if (event.button !== 0) return;
      const uv = pickSpriteUv(event);
      if (!uv) {
        isPanningRef.current = true;
        lastPointerRef.current = { x: event.clientX, y: event.clientY };
        return;
      }
      const dragTarget = resolveDragTarget(uv.u, uv.v);
      draggingRef.current = dragTarget;
      if (!dragTarget) {
        isPanningRef.current = true;
        lastPointerRef.current = { x: event.clientX, y: event.clientY };
      }
    };

    const handlePointerMove = (event: PointerEvent) => {
      const dragTarget = draggingRef.current;
      if (dragTarget) {
        const uv = pickSpriteUv(event);
        if (!uv) return;
        updatePresetByDrag(dragTarget, uv.u, uv.v);
        return;
      }
      if (!isPanningRef.current) return;

      const deltaX = event.clientX - lastPointerRef.current.x;
      const deltaY = event.clientY - lastPointerRef.current.y;
      lastPointerRef.current = { x: event.clientX, y: event.clientY };

      const worldWidth = (camera.orthoRight ?? 0) - (camera.orthoLeft ?? 0);
      const worldHeight = (camera.orthoTop ?? 0) - (camera.orthoBottom ?? 0);
      const worldPerPixelX = worldWidth / Math.max(1, engine.getRenderWidth());
      const worldPerPixelY = worldHeight / Math.max(1, engine.getRenderHeight());
      camera.target.addInPlace(new Vector3(-deltaX * worldPerPixelX, deltaY * worldPerPixelY, 0));
    };

    const handlePointerUp = () => {
      draggingRef.current = null;
      isPanningRef.current = false;
    };

    const handleWheel = (event: WheelEvent) => {
      event.preventDefault();
      const direction = Math.sign(event.deltaY);
      if (direction === 0) return;
      const nextSize = orthoSizeRef.current * (1 + direction * ZOOM_STEP);
      orthoSizeRef.current = clamp(nextSize, MIN_ORTHO_SIZE, MAX_ORTHO_SIZE);
      updateOrtho();
    };

    const handleResize = () => {
      engine.resize();
      updateOrtho();
    };

    canvas.addEventListener('pointerdown', handlePointerDown);
    canvas.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    canvas.addEventListener('wheel', handleWheel, { passive: false });
    window.addEventListener('resize', handleResize);

    engine.runRenderLoop(() => scene.render());

    return () => {
      canvas.removeEventListener('pointerdown', handlePointerDown);
      canvas.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      canvas.removeEventListener('wheel', handleWheel);
      window.removeEventListener('resize', handleResize);
      resetViewRef.current = null;
      disposeDebugMeshes();
      spriteRef.current?.mesh.dispose(false, true);
      spriteRef.current = null;
      scene.dispose();
      engine.dispose();
      sceneRef.current = null;
    };
  }, [disposeDebugMeshes, updatePresetByDrag]);

  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    disposeDebugMeshes();
    spriteRef.current?.mesh.dispose(false, true);
    const texturePath = encodeURI(`/${activeImagePath || imagePath}`);
    spriteRef.current = createMockSprite(scene, texturePath, 4.8, 'merged');
    spriteRef.current?.setFrameRegion(currentFrameRegion);
    redrawDebugHelper(presetRef.current);
  }, [disposeDebugMeshes, imagePath, activeImagePath, redrawDebugHelper, currentFrameRegion]);

  useEffect(() => {
    spriteRef.current?.setFrameRegion(currentFrameRegion);
  }, [currentFrameRegion]);

  useEffect(() => {
    saveLastAtlasJsonPath(atlasJsonPath);
  }, [atlasJsonPath]);

  useEffect(() => {
    saveLastEditorMode(mode);
  }, [mode]);

  return (
    <div style={{ padding: 16, height: '100vh', boxSizing: 'border-box', display: 'grid', gridTemplateColumns: '420px 1fr', gap: 16 }}>
      <div style={{ background: '#1a1f29', borderRadius: 12, padding: 14, overflow: 'auto' }}>
        <h2 style={{ margin: 0, marginBottom: 10 }}>Sprite 锚点编辑器</h2>
        <p style={{ marginTop: 0, color: '#9fb0c5', fontSize: 13 }}>右侧画布支持拖拽平移、滚轮缩放、左下角小地图与回正视角。</p>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
          <button
            onClick={() => {
              handleSpriteResourceChange(imagePath);
            }}
            style={{ background: mode === 'single' ? '#2e3f5e' : undefined }}
          >
            单图模式
          </button>
          <button
            onClick={() => {
              setMode('atlas');
              if (!atlasData) void loadAtlas(atlasJsonPath || scannedAtlasOptions[0] || DEFAULT_ATLAS_JSON_PATH);
            }}
            style={{ background: mode === 'atlas' ? '#2e3f5e' : undefined }}
          >
            TexturePacker 图集模式
          </button>
        </div>

        {mode === 'single' ? (
          <>
            <label style={{ display: 'block', marginBottom: 6, fontSize: 13 }}>图片路径（基于 public）</label>
            <input
              value={imagePath}
              onChange={(e) => handleSpriteResourceChange(e.target.value)}
              placeholder="resources/优势.png"
              style={{ width: '100%', marginBottom: 8, padding: '8px 10px', borderRadius: 6, border: '1px solid #3a4253', background: '#11151d', color: '#e8edf2' }}
            />
            <label style={{ display: 'block', marginBottom: 6, fontSize: 13 }}>资源图片列表（自动扫描 public）</label>
            <select
              value={normalizedImagePath}
              onChange={(e) => handleSpriteResourceChange(e.target.value)}
              style={{ width: '100%', marginBottom: 8, padding: '8px 10px', borderRadius: 6, border: '1px solid #3a4253', background: '#11151d', color: '#e8edf2' }}
            >
              {resourceImageOptions.map((key) => (
                <option key={key} value={key}>{key}</option>
              ))}
            </select>
          </>
        ) : (
          <>
            <label style={{ display: 'block', marginBottom: 6, fontSize: 13 }}>图集 JSON 路径（自动扫描 public）</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 86px', gap: 8, marginBottom: 8 }}>
              {scannedAtlasOptions.length > 0 ? (
                <select
                  value={atlasJsonPath}
                  onChange={(e) => {
                    const newPath = e.target.value;
                    if (!newPath || newPath === atlasJsonPath) return;
                    setAtlasJsonPath(newPath);
                    void loadAtlas(newPath);
                  }}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #3a4253', background: '#11151d', color: '#e8edf2' }}
                >
                  <option value="" disabled>-- 请选择图集 --</option>
                  {scannedAtlasOptions.map((path) => (
                    <option key={path} value={path}>{path}</option>
                  ))}
                </select>
              ) : (
                <input
                  value={atlasJsonPath}
                  onChange={(e) => setAtlasJsonPath(e.target.value)}
                  placeholder="未扫描到 JSON，请手动输入..."
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #3a4253', background: '#11151d', color: '#e8edf2' }}
                />
              )}
              <button onClick={() => loadAtlas(atlasJsonPath)}>加载图集</button>
            </div>
            <label style={{ display: 'block', marginBottom: 6, fontSize: 13 }}>图集帧（同一纹理不同区域）</label>
            <select
              value={selectedFrameName}
              onChange={(e) => handleAtlasFrameSelectChange(e.target.value)}
              style={{ width: '100%', marginBottom: 8, padding: '8px 10px', borderRadius: 6, border: '1px solid #3a4253', background: '#11151d', color: '#e8edf2' }}
            >
              {frameNames.map((name) => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
            <div style={{ fontSize: 12, color: '#9fb0c5', marginBottom: 8 }}>
              当前图集纹理：{atlasImagePath || '-'}
            </div>
          </>
        )}

        <label style={{ display: 'block', marginBottom: 6, fontSize: 13 }}>快速选择已有锚点配置</label>
        <select
          value={activePresetKey}
          onChange={(e) => { void handlePresetSelectionChange(e.target.value); }}
          style={{ width: '100%', marginBottom: 8, padding: '8px 10px', borderRadius: 6, border: '1px solid #3a4253', background: '#11151d', color: '#e8edf2' }}
        >
          {allPresetKeys.map((key) => (
            <option key={key} value={key}>{key}</option>
          ))}
        </select>
        <div style={{ fontSize: 12, color: '#6f8098', marginBottom: 10 }}>当前预设 Key：{activePresetKey}</div>

        <div style={{ fontSize: 12, color: '#9fb0c5', marginBottom: 10 }}>{presetSourceLabel}</div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
          <button onClick={importCurrentLocalPreset}>导入本地配置</button>
          <button onClick={saveCurrentPreset}>保存到本地</button>
          <button onClick={clearCurrentPreset}>清除本地覆盖</button>
          <button onClick={exportJson}>导出 JSON</button>
          <button onClick={copyCurrentPreset}>复制配置</button>
          <button onClick={pastePreset}>粘贴配置</button>
        </div>

        <div style={{ marginBottom: 12, fontSize: 12, color: '#9fb0c5' }}>{message}</div>

        <h3 style={{ margin: '10px 0 8px 0', fontSize: 15 }}>锚点精确数据（{ANCHOR_MIN}~{ANCHOR_MAX}）</h3>
        <div>
          {renderDragNumberControl('head.u（顶部锚点 X）', 'head.u', preset.anchors.head.u, ANCHOR_MIN, ANCHOR_MAX)}
          {renderDragNumberControl('head.v（顶部锚点 Y）', 'head.v', preset.anchors.head.v, ANCHOR_MIN, ANCHOR_MAX)}
          {renderDragNumberControl('foot.u（底部锚点 X）', 'foot.u', preset.anchors.foot.u, ANCHOR_MIN, ANCHOR_MAX)}
          {renderDragNumberControl('foot.v（底部锚点 Y）', 'foot.v', preset.anchors.foot.v, ANCHOR_MIN, ANCHOR_MAX)}
          {renderDragNumberControl('center.u（中心锚点 X）', 'center.u', preset.anchors.center.u, ANCHOR_MIN, ANCHOR_MAX)}
          {renderDragNumberControl('center.v（中心锚点 Y）', 'center.v', preset.anchors.center.v, ANCHOR_MIN, ANCHOR_MAX)}
          {renderDragNumberControl('bodyAxisX（身体中轴线）', 'bodyAxisX', preset.bodyAxisX, ANCHOR_MIN, ANCHOR_MAX)}
          <div style={{ color: '#9fb0c5', fontSize: 12, marginTop: 2 }}>当前缩放: {zoomLabel}</div>
        </div>

        <h3 style={{ margin: '12px 0 8px 0', fontSize: 15 }}>特殊包围盒（{BOUNDS_MIN}~{BOUNDS_MAX}）</h3>
        <div>
          {renderDragNumberControl('bodyBounds.minU（左边界）', 'minU', preset.bodyBounds.minU, BOUNDS_MIN, BOUNDS_MAX)}
          {renderDragNumberControl('bodyBounds.maxU（右边界）', 'maxU', preset.bodyBounds.maxU, BOUNDS_MIN, BOUNDS_MAX)}
          {renderDragNumberControl('bodyBounds.minV（上边界）', 'minV', preset.bodyBounds.minV, BOUNDS_MIN, BOUNDS_MAX)}
          {renderDragNumberControl('bodyBounds.maxV（下边界）', 'maxV', preset.bodyBounds.maxV, BOUNDS_MIN, BOUNDS_MAX)}
        </div>
      </div>

      <div style={{ background: '#1a1f29', borderRadius: 12, padding: 12, position: 'relative', minHeight: 0 }}>
        <div style={{ marginBottom: 8, color: '#9fb0c5', fontSize: 13, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>使用 Babylon 实时渲染：红=head，蓝=center，绿=foot，黄框=bodyBounds（drawSpriteDebugHelper）</span>
          <button onClick={() => resetViewRef.current?.()} style={{ marginLeft: 8 }}>视角回到原位</button>
        </div>

        <canvas
          ref={canvasRef}
          style={{
            width: '100%',
            height: 'calc(100% - 38px)',
            minHeight: 520,
            background: '#0f1319',
            borderRadius: 8,
            display: 'block',
            cursor: 'grab'
          }}
        />
      </div>
    </div>
  );
};
