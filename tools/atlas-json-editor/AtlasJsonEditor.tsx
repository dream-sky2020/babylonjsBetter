import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { requestDevServer } from '@/core/network/devServerPortResolver.ts';
import { resolveAppAssetUrl } from '@/core/resources';

type EditorMode = 'manual' | 'grid' | 'irregular';
type GridSplitMode = 'cell-size' | 'rows-columns';

type Point = { x: number; y: number };

type FrameEntry = {
  id: number;
  name: string;
  x: number;
  y: number;
  w: number;
  h: number;
  rotated: boolean;
  trimmed: boolean;
  spriteSourceSize: { x: number; y: number; w: number; h: number };
  sourceSize: { w: number; h: number };
  pivot?: { x: number; y: number };
};

type ManualDraft = {
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
} | null;

type AtlasJsonFrame = {
  frame: { x: number; y: number; w: number; h: number };
  rotated?: boolean;
  trimmed?: boolean;
  spriteSourceSize?: { x: number; y: number; w: number; h: number };
  sourceSize?: { w: number; h: number };
  pivot?: { x: number; y: number };
};

type AtlasJson = {
  frames?: Record<string, AtlasJsonFrame>;
  meta?: {
    app?: string;
    version?: string;
    image?: string;
    format?: string;
    size?: { w?: number; h?: number };
    scale?: string | number;
  };
};

const ATLAS_EDITOR_DRAFT_KEY = 'atlas-json-editor.draft.v1';
const LAST_ATLAS_JSON_PATH_KEY = 'atlas-json-editor.last-atlas-json-path';
const LAST_IMAGE_RESOURCE_PATH_KEY = 'atlas-json-editor.last-image-resource-path';

type AtlasEditorDraft = {
  mode: EditorMode;
  atlasJsonPath: string;
  atlasMetaApp: string;
  atlasMetaVersion: string;
  atlasMetaFormat: string;
  atlasMetaScale: string;
  imageFileName: string;
  imageResourcePath: string;
  imageWidth: number;
  imageHeight: number;
  frameWidth: number;
  frameHeight: number;
  gridSplitMode?: GridSplitMode;
  startX: number;
  startY: number;
  gapX: number;
  gapY: number;
  columnCount: number;
  rowCount: number;
  maxCount: number;
  namePrefix: string;
  nameLinesText: string;
  frames: FrameEntry[];
};

const normalizeResourcePath = (rawPath: string): string => {
  return rawPath.trim().replace(/^\/+/, '').replace(/^public\//, '');
};

const RESOURCE_ATLAS_JSON_OPTIONS = Object.keys(import.meta.glob('/public/**/*.json'))
  .map((path) => normalizeResourcePath(path).replace(/^public\/+/, ''))
  .sort((a, b) => a.localeCompare(b, 'zh-CN'));

const RESOURCE_IMAGE_OPTIONS = Object.keys(import.meta.glob('/public/**/*.{png,jpg,jpeg,webp}'))
  .map((path) => normalizeResourcePath(path).replace(/^public\/+/, ''))
  .sort((a, b) => a.localeCompare(b, 'zh-CN'));

const getLocalStorageString = (key: string): string => {
  if (typeof window === 'undefined') return '';
  try {
    return window.localStorage.getItem(key) ?? '';
  } catch {
    return '';
  }
};

const clampPositive = (value: number, fallback: number): number => {
  if (!Number.isFinite(value) || value <= 0) return fallback;
  return Math.floor(value);
};

const clamp = (value: number, min: number, max: number): number => {
  if (value < min) return min;
  if (value > max) return max;
  return value;
};

const toInt = (value: string): number => {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : 0;
};

const toFloat = (value: string, fallback = 0): number => {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const parseNamesText = (text: string): string[] => {
  return text
    .split(/\r?\n/g)
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
};

const buildDefaultFrameName = (prefix: string, index: number): string => {
  const safePrefix = prefix.trim() || 'frame';
  return `${safePrefix}-${String(index + 1).padStart(3, '0')}.png`;
};

const ensurePngExt = (name: string): string => {
  if (name.toLowerCase().endsWith('.png')) return name;
  return `${name}.png`;
};

const makeUniqueName = (candidate: string, existingNames: Set<string>): string => {
  const normalized = ensurePngExt(candidate.trim() || 'frame.png');
  if (!existingNames.has(normalized)) return normalized;
  const dotIndex = normalized.lastIndexOf('.');
  const base = dotIndex >= 0 ? normalized.slice(0, dotIndex) : normalized;
  const ext = dotIndex >= 0 ? normalized.slice(dotIndex) : '';
  let index = 2;
  while (existingNames.has(`${base}_${index}${ext}`)) {
    index += 1;
  }
  return `${base}_${index}${ext}`;
};

const dedupeNames = (frames: FrameEntry[]): { frames: FrameEntry[]; duplicateCount: number } => {
  const seen = new Map<string, number>();
  let duplicateCount = 0;
  const nextFrames = frames.map((frame) => {
    const original = frame.name.trim() || `frame-${frame.id + 1}.png`;
    const baseName = ensurePngExt(original);
    const hitCount = seen.get(baseName) ?? 0;
    if (hitCount === 0) {
      seen.set(baseName, 1);
      return { ...frame, name: baseName };
    }
    duplicateCount += 1;
    const dotIndex = baseName.lastIndexOf('.');
    const base = dotIndex >= 0 ? baseName.slice(0, dotIndex) : baseName;
    const ext = dotIndex >= 0 ? baseName.slice(dotIndex) : '';
    const unique = `${base}_${hitCount + 1}${ext}`;
    seen.set(baseName, hitCount + 1);
    seen.set(unique, 1);
    return { ...frame, name: unique };
  });
  return { frames: nextFrames, duplicateCount };
};

const createFrameEntry = (id: number, name: string, x: number, y: number, w: number, h: number): FrameEntry => ({
  id,
  name: ensurePngExt(name),
  x,
  y,
  w,
  h,
  rotated: false,
  trimmed: false,
  spriteSourceSize: { x: 0, y: 0, w, h },
  sourceSize: { w, h },
  pivot: { x: 0.5, y: 0.5 }
});

const resolveAtlasImagePath = (atlasJsonPath: string, imageName: string): string => {
  const trimmed = imageName.trim();
  if (!trimmed) return '';
  if (trimmed.startsWith('blob:') || trimmed.startsWith('data:') || /^https?:\/\//.test(trimmed)) return trimmed;
  if (trimmed.startsWith('/')) return trimmed;
  const jsonPath = normalizeResourcePath(atlasJsonPath);
  const dir = jsonPath.includes('/') ? jsonPath.slice(0, jsonPath.lastIndexOf('/')) : '';
  const joined = trimmed.includes('/') ? normalizeResourcePath(trimmed) : (dir ? `${dir}/${trimmed}` : trimmed);
  return `/${joined}`;
};

export const AtlasJsonEditor: React.FC = () => {
  const [mode, setMode] = useState<EditorMode>('manual');
  const [atlasJsonPath, setAtlasJsonPath] = useState(() => {
    const saved = normalizeResourcePath(getLocalStorageString(LAST_ATLAS_JSON_PATH_KEY));
    return saved || RESOURCE_ATLAS_JSON_OPTIONS[0] || 'resources/左下小人图集.json';
  });
  const [atlasMetaApp, setAtlasMetaApp] = useState('https://www.codeandweb.com/texturepacker');
  const [atlasMetaVersion, setAtlasMetaVersion] = useState('1.0');
  const [atlasMetaFormat, setAtlasMetaFormat] = useState('RGBA8888');
  const [atlasMetaScale, setAtlasMetaScale] = useState('1');

  const [imageFileName, setImageFileName] = useState('atlas.png');
  const [imageResourcePath, setImageResourcePath] = useState(() =>
    getLocalStorageString(LAST_IMAGE_RESOURCE_PATH_KEY)
  );
  const [imageSrc, setImageSrc] = useState('');
  const [imageWidth, setImageWidth] = useState(0);
  const [imageHeight, setImageHeight] = useState(0);

  const [frameWidth, setFrameWidth] = useState(333);
  const [frameHeight, setFrameHeight] = useState(246);
  const [gridSplitMode, setGridSplitMode] = useState<GridSplitMode>('cell-size');
  const [autoAlphaThreshold, setAutoAlphaThreshold] = useState(8);
  const [autoMinPixelArea, setAutoMinPixelArea] = useState(64);
  const [startX, setStartX] = useState(0);
  const [startY, setStartY] = useState(0);
  const [gapX, setGapX] = useState(0);
  const [gapY, setGapY] = useState(0);
  const [columnCount, setColumnCount] = useState(0);
  const [rowCount, setRowCount] = useState(0);
  const [maxCount, setMaxCount] = useState(0);

  const [namePrefix, setNamePrefix] = useState('角色默认');
  const [nameLinesText, setNameLinesText] = useState('');

  const [frames, setFrames] = useState<FrameEntry[]>([]);
  const [selectedFrameId, setSelectedFrameId] = useState<number | null>(null);
  const [manualDraft, setManualDraft] = useState<ManualDraft>(null);
  const [polygonDraft, setPolygonDraft] = useState<Point[]>([]);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('请先上传大图，或直接加载已有 Atlas JSON。');
  const [draftHydrated, setDraftHydrated] = useState(false);
  const autoRestoreAttemptedRef = useRef(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(LAST_ATLAS_JSON_PATH_KEY, atlasJsonPath);
    } catch {
      // ignore storage errors
    }
  }, [atlasJsonPath]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(LAST_IMAGE_RESOURCE_PATH_KEY, imageResourcePath);
    } catch {
      // ignore storage errors
    }
  }, [imageResourcePath]);

  /* eslint-disable react-hooks/set-state-in-effect -- one-time local draft hydration */
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(ATLAS_EDITOR_DRAFT_KEY);
      if (!raw) return;
      const draft = JSON.parse(raw) as Partial<AtlasEditorDraft>;
      if (draft.mode === 'manual' || draft.mode === 'grid' || draft.mode === 'irregular') {
        setMode(draft.mode);
      }
      if (typeof draft.atlasJsonPath === 'string' && draft.atlasJsonPath.trim()) {
        setAtlasJsonPath(normalizeResourcePath(draft.atlasJsonPath));
      }
      if (typeof draft.atlasMetaApp === 'string') setAtlasMetaApp(draft.atlasMetaApp);
      if (typeof draft.atlasMetaVersion === 'string') setAtlasMetaVersion(draft.atlasMetaVersion);
      if (typeof draft.atlasMetaFormat === 'string') setAtlasMetaFormat(draft.atlasMetaFormat);
      if (typeof draft.atlasMetaScale === 'string') setAtlasMetaScale(draft.atlasMetaScale);
      if (typeof draft.imageFileName === 'string') setImageFileName(draft.imageFileName);
      if (typeof draft.imageResourcePath === 'string') setImageResourcePath(draft.imageResourcePath);
      if (typeof draft.frameWidth === 'number') setFrameWidth(draft.frameWidth);
      if (typeof draft.frameHeight === 'number') setFrameHeight(draft.frameHeight);
      if (draft.gridSplitMode === 'cell-size' || draft.gridSplitMode === 'rows-columns') {
        setGridSplitMode(draft.gridSplitMode);
      }
      if (typeof draft.startX === 'number') setStartX(draft.startX);
      if (typeof draft.startY === 'number') setStartY(draft.startY);
      if (typeof draft.gapX === 'number') setGapX(draft.gapX);
      if (typeof draft.gapY === 'number') setGapY(draft.gapY);
      if (typeof draft.columnCount === 'number') setColumnCount(draft.columnCount);
      if (typeof draft.rowCount === 'number') setRowCount(draft.rowCount);
      if (typeof draft.maxCount === 'number') setMaxCount(draft.maxCount);
      if (typeof draft.namePrefix === 'string') setNamePrefix(draft.namePrefix);
      if (typeof draft.nameLinesText === 'string') setNameLinesText(draft.nameLinesText);
      if (Array.isArray(draft.frames)) {
        setFrames(draft.frames);
        setSelectedFrameId(draft.frames.length > 0 ? draft.frames[0].id : null);
      }
      if (
        typeof draft.imageWidth === 'number' &&
        typeof draft.imageHeight === 'number' &&
        draft.imageWidth > 0 &&
        draft.imageHeight > 0
      ) {
        setImageWidth(draft.imageWidth);
        setImageHeight(draft.imageHeight);
      }
      setMessage('已恢复上次编辑草稿，正在尝试恢复 public 图集图片。');
    } catch {
      // ignore draft parse error
    } finally {
      setDraftHydrated(true);
    }
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => {
    if (!draftHydrated) return;
    const draft: AtlasEditorDraft = {
      mode,
      atlasJsonPath,
      atlasMetaApp,
      atlasMetaVersion,
      atlasMetaFormat,
      atlasMetaScale,
      imageFileName,
      imageResourcePath,
      imageWidth,
      imageHeight,
      frameWidth,
      frameHeight,
      gridSplitMode,
      startX,
      startY,
      gapX,
      gapY,
      columnCount,
      rowCount,
      maxCount,
      namePrefix,
      nameLinesText,
      frames
    };
    try {
      window.localStorage.setItem(ATLAS_EDITOR_DRAFT_KEY, JSON.stringify(draft));
    } catch {
      // ignore storage errors
    }
  }, [
    mode,
    atlasJsonPath,
    atlasMetaApp,
    atlasMetaVersion,
    atlasMetaFormat,
    atlasMetaScale,
    imageFileName,
    imageResourcePath,
    imageWidth,
    imageHeight,
    frameWidth,
    frameHeight,
    gridSplitMode,
    startX,
    startY,
    gapX,
    gapY,
    columnCount,
    rowCount,
    maxCount,
    namePrefix,
    nameLinesText,
    frames,
    draftHydrated
  ]);

  useEffect(() => {
    return () => {
      if (imageSrc.startsWith('blob:')) {
        URL.revokeObjectURL(imageSrc);
      }
    };
  }, [imageSrc]);

  const previewRatio = useMemo(() => {
    if (!imageWidth || !imageHeight) return 1;
    const maxPreviewWidth = 920;
    return Math.min(1, maxPreviewWidth / imageWidth);
  }, [imageWidth, imageHeight]);

  const customNames = useMemo(() => parseNamesText(nameLinesText), [nameLinesText]);
  const gridEstimate = useMemo(() => {
    if (!imageWidth || !imageHeight) {
      return { valid: false, message: '请先加载图集图片。', sx: 0, sy: 0, gx: 0, gy: 0, fw: 0, fh: 0, cols: 0, rows: 0, count: 0 };
    }
    const sx = Math.max(0, Math.floor(startX));
    const sy = Math.max(0, Math.floor(startY));
    const gx = Math.max(0, Math.floor(gapX));
    const gy = Math.max(0, Math.floor(gapY));
    if (gridSplitMode === 'rows-columns') {
      const cols = Math.max(0, Math.floor(columnCount));
      const rows = Math.max(0, Math.floor(rowCount));
      if (cols <= 0 || rows <= 0) {
        return { valid: false, message: '智能均分模式只需要填写大于 0 的列数和行数。', sx: 0, sy: 0, gx: 0, gy: 0, fw: 0, fh: 0, cols, rows, count: 0 };
      }
      const fw = Math.floor(imageWidth / cols);
      const fh = Math.floor(imageHeight / rows);
      if (fw <= 0 || fh <= 0) {
        return { valid: false, message: '行数或列数超过了图片像素尺寸。', sx: 0, sy: 0, gx: 0, gy: 0, fw, fh, cols, rows, count: 0 };
      }
      return {
        valid: true,
        message: `将图片均分为 ${cols} 列 × ${rows} 行，扫描最多 ${cols * rows} 格；透明空格会自动跳过。`,
        sx: 0, sy: 0, gx: 0, gy: 0, fw, fh, cols, rows, count: cols * rows
      };
    }
    if (sx >= imageWidth || sy >= imageHeight) {
      return { valid: false, message: '起点必须位于图像范围内。', sx, sy, gx, gy, fw: 0, fh: 0, cols: 0, rows: 0, count: 0 };
    }
    const manualFw = Math.max(0, Math.floor(frameWidth));
    const manualFh = Math.max(0, Math.floor(frameHeight));
    const estimatedFw = columnCount > 0
      ? Math.floor((imageWidth - sx - Math.max(0, columnCount - 1) * gx) / columnCount)
      : 0;
    const estimatedFh = rowCount > 0
      ? Math.floor((imageHeight - sy - Math.max(0, rowCount - 1) * gy) / rowCount)
      : 0;
    const fw = manualFw > 0 ? manualFw : estimatedFw;
    const fh = manualFh > 0 ? manualFh : estimatedFh;
    if (fw <= 0 || fh <= 0) {
      return { valid: false, message: '帧宽高为 0 时，必须填写对应的列数和行数。', sx, sy, gx, gy, fw, fh, cols: 0, rows: 0, count: 0 };
    }
    const fitCols = Math.max(0, Math.floor((imageWidth - sx + gx) / (fw + gx)));
    const fitRows = Math.max(0, Math.floor((imageHeight - sy + gy) / (fh + gy)));
    const cols = columnCount > 0 ? Math.min(Math.floor(columnCount), fitCols) : fitCols;
    const rows = rowCount > 0 ? Math.min(Math.floor(rowCount), fitRows) : fitRows;
    const unlimitedCount = cols * rows;
    const count = maxCount > 0 ? Math.min(Math.floor(maxCount), unlimitedCount) : unlimitedCount;
    if (count <= 0) {
      return { valid: false, message: '当前帧尺寸、起点或间隔无法在图片内放下任何切片。', sx, sy, gx, gy, fw, fh, cols, rows, count: 0 };
    }
    return { valid: true, message: `预计 ${cols} 列 × ${rows} 行，共 ${count} 个切片；帧尺寸 ${fw} × ${fh}px。`, sx, sy, gx, gy, fw, fh, cols, rows, count };
  }, [imageWidth, imageHeight, startX, startY, gapX, gapY, frameWidth, frameHeight, columnCount, rowCount, maxCount, gridSplitMode]);
  const selectedFrame = useMemo(
    () => frames.find((entry) => entry.id === selectedFrameId) ?? null,
    [frames, selectedFrameId]
  );

  const generatedAtlas = useMemo<AtlasJson>(() => {
    const atlasFrames: Record<string, AtlasJsonFrame> = {};
    frames.forEach((entry) => {
      atlasFrames[entry.name] = {
        frame: { x: entry.x, y: entry.y, w: entry.w, h: entry.h },
        rotated: entry.rotated,
        trimmed: entry.trimmed,
        spriteSourceSize: { ...entry.spriteSourceSize },
        sourceSize: { ...entry.sourceSize },
        pivot: entry.pivot ? { ...entry.pivot } : undefined
      };
    });

    return {
      frames: atlasFrames,
      meta: {
        app: atlasMetaApp,
        version: atlasMetaVersion,
        image: imageFileName || 'atlas.png',
        format: atlasMetaFormat,
        size: { w: imageWidth, h: imageHeight },
        scale: atlasMetaScale
      }
    };
  }, [frames, atlasMetaApp, atlasMetaVersion, imageFileName, atlasMetaFormat, imageWidth, imageHeight, atlasMetaScale]);

  const atlasJsonText = useMemo(() => JSON.stringify(generatedAtlas, null, 2), [generatedAtlas]);

  const getImageCoordinate = (event: React.MouseEvent<HTMLDivElement>): { x: number; y: number } => {
    const rect = event.currentTarget.getBoundingClientRect();
    const px = event.clientX - rect.left;
    const py = event.clientY - rect.top;
    const x = Math.round(clamp(px / previewRatio, 0, imageWidth));
    const y = Math.round(clamp(py / previewRatio, 0, imageHeight));
    return { x, y };
  };

  const getNextFrameName = (nextIndex: number, existingNames: Set<string>): string => {
    const fromCustom = customNames[nextIndex];
    const fallback = buildDefaultFrameName(namePrefix, nextIndex);
    return makeUniqueName(fromCustom || fallback, existingNames);
  };

  const appendFrame = (x: number, y: number, w: number, h: number, source: '手动' | '不规则'): void => {
    if (w < 2 || h < 2) {
      setMessage(`${source}选区太小，已忽略。`);
      return;
    }
    setFrames((prev) => {
      const existingNames = new Set(prev.map((entry) => entry.name));
      const nextId = prev.length;
      const nextName = getNextFrameName(nextId, existingNames);
      const next = [...prev, createFrameEntry(nextId, nextName, x, y, w, h)];
      setSelectedFrameId(nextId);
      setMessage(`已新增${source}切片 #${nextId + 1}：(${x}, ${y}, ${w}, ${h})`);
      return next;
    });
  };

  const findFrameIdByPoint = (x: number, y: number): number | null => {
    for (let i = frames.length - 1; i >= 0; i -= 1) {
      const frame = frames[i];
      if (x >= frame.x && x <= frame.x + frame.w && y >= frame.y && y <= frame.y + frame.h) {
        return frame.id;
      }
    }
    return null;
  };

  const applyAtlasData = (atlas: AtlasJson, sourceLabel: string): void => {
    if (!atlas.frames || typeof atlas.frames !== 'object') {
      setMessage(`加载失败：${sourceLabel} 缺少 frames。`);
      return;
    }

    const frameEntries: FrameEntry[] = Object.entries(atlas.frames).map(([name, payload], index) => {
      const frame = payload.frame ?? { x: 0, y: 0, w: 1, h: 1 };
      const w = clampPositive(frame.w ?? 1, 1);
      const h = clampPositive(frame.h ?? 1, 1);
      return {
        id: index,
        name: ensurePngExt(name),
        x: Math.max(0, Math.floor(frame.x ?? 0)),
        y: Math.max(0, Math.floor(frame.y ?? 0)),
        w,
        h,
        rotated: Boolean(payload.rotated),
        trimmed: Boolean(payload.trimmed),
        spriteSourceSize: payload.spriteSourceSize
          ? {
              x: Math.floor(payload.spriteSourceSize.x ?? 0),
              y: Math.floor(payload.spriteSourceSize.y ?? 0),
              w: clampPositive(payload.spriteSourceSize.w ?? w, w),
              h: clampPositive(payload.spriteSourceSize.h ?? h, h)
            }
          : { x: 0, y: 0, w, h },
        sourceSize: payload.sourceSize
          ? {
              w: clampPositive(payload.sourceSize.w ?? w, w),
              h: clampPositive(payload.sourceSize.h ?? h, h)
            }
          : { w, h },
        pivot: payload.pivot
          ? { x: Number(payload.pivot.x ?? 0.5), y: Number(payload.pivot.y ?? 0.5) }
          : { x: 0.5, y: 0.5 }
      };
    });

    const dedupeResult = dedupeNames(frameEntries);
    setFrames(dedupeResult.frames);
    setSelectedFrameId(dedupeResult.frames.length > 0 ? 0 : null);
    setPolygonDraft([]);
    setManualDraft(null);

    const meta = atlas.meta ?? {};
    setAtlasMetaApp(meta.app || 'https://www.codeandweb.com/texturepacker');
    setAtlasMetaVersion(meta.version || '1.0');
    setAtlasMetaFormat(meta.format || 'RGBA8888');
    setAtlasMetaScale(String(meta.scale ?? '1'));

    const nextImageName = meta.image || imageFileName;
    setImageFileName(nextImageName);

    const maybeWidth = clampPositive(Number(meta.size?.w ?? 0), 0);
    const maybeHeight = clampPositive(Number(meta.size?.h ?? 0), 0);
    if (maybeWidth > 0 && maybeHeight > 0) {
      setImageWidth(maybeWidth);
      setImageHeight(maybeHeight);
    }

    setMessage(`已加载 ${sourceLabel}，共 ${dedupeResult.frames.length} 个切片。`);
  };

  const loadImageByUrl = useCallback((url: string): Promise<void> => {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => {
        if (imageSrc.startsWith('blob:')) {
          URL.revokeObjectURL(imageSrc);
        }
        setImageSrc(url);
        setImageWidth(image.width);
        setImageHeight(image.height);
        resolve();
      };
      image.onerror = reject;
      image.src = url;
    });
  }, [imageSrc]);

  useEffect(() => {
    if (!draftHydrated || autoRestoreAttemptedRef.current || imageSrc) return;
    const normalized = normalizeResourcePath(imageResourcePath);
    if (!normalized) return;
    autoRestoreAttemptedRef.current = true;
    void loadImageByUrl(`/${normalized}`).then(() => {
      const baseName = normalized.slice(normalized.lastIndexOf('/') + 1);
      if (baseName) setImageFileName(baseName);
      setMessage(`已自动恢复图集图片：${normalized}`);
    }).catch(() => {
      setMessage(`草稿已恢复，但图片无法自动加载：/${normalized}`);
    });
  }, [draftHydrated, imageResourcePath, imageSrc, loadImageByUrl]);

  const loadAtlasFromPath = async (pathOverride?: string): Promise<void> => {
    const normalized = normalizeResourcePath(pathOverride ?? atlasJsonPath);
    if (!normalized) {
      setMessage('请输入 atlas JSON 路径。');
      return;
    }

    try {
      const response = await fetch(resolveAppAssetUrl(normalized));
      if (!response.ok) {
        setMessage(`加载失败：HTTP ${response.status}`);
        return;
      }
      const data = (await response.json()) as AtlasJson;
      setAtlasJsonPath(normalized);
      applyAtlasData(data, normalized);
      const imageUrl = resolveAtlasImagePath(normalized, data.meta?.image ?? imageFileName);
      setImageResourcePath(imageUrl.startsWith('/') ? imageUrl.slice(1) : imageUrl);
      if (imageUrl) {
        try {
          await loadImageByUrl(imageUrl);
          setMessage((prev) => `${prev} 图片已加载。`);
        } catch {
          setMessage((prev) => `${prev} 但图片加载失败，请手动上传图集图像。`);
        }
      }
    } catch {
      setMessage('加载 atlas JSON 失败，请检查路径。');
    }
  };

  const handleAtlasFileUpload: React.ChangeEventHandler<HTMLInputElement> = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const data = JSON.parse(text) as AtlasJson;
      applyAtlasData(data, file.name);
      setAtlasJsonPath(file.name);
      const imageUrl = resolveAtlasImagePath(file.name, data.meta?.image ?? '');
      if (imageUrl.startsWith('/')) {
        try {
          await loadImageByUrl(imageUrl);
          setMessage((prev) => `${prev} 图片已按路径尝试加载。`);
        } catch {
          setMessage((prev) => `${prev} 未找到同路径图片，请手动上传。`);
        }
      }
    } catch {
      setMessage('JSON 文件解析失败。');
    } finally {
      event.target.value = '';
    }
  };

  const handleImageUpload: React.ChangeEventHandler<HTMLInputElement> = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      if (imageSrc.startsWith('blob:')) {
        URL.revokeObjectURL(imageSrc);
      }
      setImageSrc(objectUrl);
      setImageWidth(image.width);
      setImageHeight(image.height);
      setImageFileName(file.name);
      setImageResourcePath('');
      setMessage(`已加载图片：${file.name}（${image.width}x${image.height}）`);
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      setMessage('图片加载失败，请重试。');
    };
    image.src = objectUrl;
  };

  const loadImageFromResourcePath = async (pathOverride?: string): Promise<void> => {
    const normalized = normalizeResourcePath(pathOverride ?? imageResourcePath);
    if (!normalized) {
      setMessage('请输入 public 下的图片路径，例如 resources/xxx.png');
      return;
    }
    try {
      await loadImageByUrl(`/${normalized}`);
      const baseName = normalized.includes('/') ? normalized.slice(normalized.lastIndexOf('/') + 1) : normalized;
      setImageFileName(baseName);
      setImageResourcePath(normalized);
      setMessage(`已从 public 加载图片：${normalized}`);
    } catch {
      setMessage(`图片加载失败：/${normalized}`);
    }
  };

  const generateFrames = async (): Promise<void> => {
    if (!gridEstimate.valid) {
      setMessage(`无法生成网格切片：${gridEstimate.message}`);
      return;
    }
    if (gridSplitMode === 'rows-columns') {
      if (!imageSrc) {
        setMessage('无法扫描空格：请先加载图集图片。');
        return;
      }
      setMessage('正在扫描网格内容…');
      try {
        const canvas = document.createElement('canvas');
        canvas.width = imageWidth;
        canvas.height = imageHeight;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) throw new Error('无法创建 2D 画布');
        const image = new Image();
        image.src = imageSrc;
        if (!image.complete) {
          await new Promise<void>((resolve, reject) => {
            image.onload = () => resolve();
            image.onerror = () => reject(new Error('图片解码失败'));
          });
        }
        ctx.drawImage(image, 0, 0, imageWidth, imageHeight);
        const pixels = ctx.getImageData(0, 0, imageWidth, imageHeight).data;
        const threshold = clamp(Math.floor(autoAlphaThreshold), 1, 255);
        const nextFrames: FrameEntry[] = [];
        let skippedEmpty = 0;

        for (let row = 0; row < gridEstimate.rows; row += 1) {
          const y0 = Math.floor((row * imageHeight) / gridEstimate.rows);
          const y1 = Math.floor(((row + 1) * imageHeight) / gridEstimate.rows);
          for (let col = 0; col < gridEstimate.cols; col += 1) {
            const x0 = Math.floor((col * imageWidth) / gridEstimate.cols);
            const x1 = Math.floor(((col + 1) * imageWidth) / gridEstimate.cols);
            let hasVisiblePixel = false;
            for (let y = y0; y < y1 && !hasVisiblePixel; y += 1) {
              for (let x = x0; x < x1; x += 1) {
                if (pixels[(y * imageWidth + x) * 4 + 3] >= threshold) {
                  hasVisiblePixel = true;
                  break;
                }
              }
            }
            if (!hasVisiblePixel) {
              skippedEmpty += 1;
              continue;
            }
            const index = nextFrames.length;
            const mappedName = customNames[index] || buildDefaultFrameName(namePrefix, index);
            nextFrames.push(createFrameEntry(index, mappedName, x0, y0, x1 - x0, y1 - y0));
          }
        }

        const dedupeResult = dedupeNames(nextFrames);
        setFrames(dedupeResult.frames);
        setSelectedFrameId(dedupeResult.frames.length > 0 ? 0 : null);
        setMessage(`智能网格切分完成：生成 ${dedupeResult.frames.length} 个切片，跳过 ${skippedEmpty} 个透明空格。`);
      } catch (error) {
        setMessage(`智能网格切分失败：${error instanceof Error ? error.message : String(error)}`);
      }
      return;
    }
    const { sx, sy, gx, gy, fw, fh, cols, rows } = gridEstimate;
    const manualFw = Math.max(0, Math.floor(frameWidth));
    const manualFh = Math.max(0, Math.floor(frameHeight));

    const nextFrames: FrameEntry[] = [];
    const limitedCount = maxCount > 0 ? Math.floor(maxCount) : Number.POSITIVE_INFINITY;
    for (let row = 0; row < rows; row += 1) {
      for (let col = 0; col < cols; col += 1) {
        if (nextFrames.length >= limitedCount) break;
        const x = sx + col * (fw + gx);
        const y = sy + row * (fh + gy);
        const index = nextFrames.length;
        const mappedName = customNames[index] || buildDefaultFrameName(namePrefix, index);
        nextFrames.push(createFrameEntry(index, mappedName, x, y, fw, fh));
      }
      if (nextFrames.length >= limitedCount) break;
    }

    const dedupeResult = dedupeNames(nextFrames);
    setFrames(dedupeResult.frames);
    setSelectedFrameId(dedupeResult.frames.length > 0 ? 0 : null);
    const autoSizeHint =
      manualFw <= 0 || manualFh <= 0 ? `（自动尺寸 ${fw}x${fh}）` : '';
    setMessage(`已生成 ${dedupeResult.frames.length} 个网格切片${autoSizeHint}。`);
  };

  const autoSliceFrames = async (): Promise<void> => {
    if (!imageSrc || !imageWidth || !imageHeight) {
      setMessage('请先加载图片。');
      return;
    }

    const threshold = clampPositive(autoAlphaThreshold, 1);
    const minArea = clampPositive(autoMinPixelArea, 1);
    const canvas = document.createElement('canvas');
    canvas.width = imageWidth;
    canvas.height = imageHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      setMessage('自动切片失败：无法创建 2D 画布。');
      return;
    }

    const image = new Image();
    image.src = imageSrc;
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error('image load failed'));
    }).catch(() => {
      setMessage('自动切片失败：图片解码失败。');
    });
    if (!image.complete) return;

    ctx.drawImage(image, 0, 0, imageWidth, imageHeight);
    const { data } = ctx.getImageData(0, 0, imageWidth, imageHeight);
    const visited = new Uint8Array(imageWidth * imageHeight);
    const boxes: Array<{ x: number; y: number; w: number; h: number; area: number }> = [];

    const queue = new Int32Array(imageWidth * imageHeight);
    const hasPixel = (index: number): boolean => data[index * 4 + 3] >= threshold;

    for (let y = 0; y < imageHeight; y += 1) {
      for (let x = 0; x < imageWidth; x += 1) {
        const startIndex = y * imageWidth + x;
        if (visited[startIndex] === 1 || !hasPixel(startIndex)) {
          continue;
        }

        let head = 0;
        let tail = 0;
        queue[tail] = startIndex;
        tail += 1;
        visited[startIndex] = 1;

        let minX = x;
        let maxX = x;
        let minY = y;
        let maxY = y;
        let count = 0;

        while (head < tail) {
          const current = queue[head];
          head += 1;
          count += 1;
          const cx = current % imageWidth;
          const cy = Math.floor(current / imageWidth);
          if (cx < minX) minX = cx;
          if (cx > maxX) maxX = cx;
          if (cy < minY) minY = cy;
          if (cy > maxY) maxY = cy;

          const neighbors = [
            current - 1,
            current + 1,
            current - imageWidth,
            current + imageWidth
          ];
          for (const next of neighbors) {
            if (next < 0 || next >= visited.length || visited[next] === 1) continue;
            const nx = next % imageWidth;
            const ny = Math.floor(next / imageWidth);
            if (Math.abs(nx - cx) + Math.abs(ny - cy) !== 1) continue;
            if (!hasPixel(next)) continue;
            visited[next] = 1;
            queue[tail] = next;
            tail += 1;
          }
        }

        if (count < minArea) continue;
        boxes.push({
          x: minX,
          y: minY,
          w: maxX - minX + 1,
          h: maxY - minY + 1,
          area: count
        });
      }
    }

    if (boxes.length === 0) {
      setFrames([]);
      setSelectedFrameId(null);
      setMessage('自动切片未找到有效区域，请降低 alpha 阈值或最小面积。');
      return;
    }

    boxes.sort((a, b) => {
      if (Math.abs(a.y - b.y) > 8) return a.y - b.y;
      return a.x - b.x;
    });

    const nextFrames = boxes.map((box, index) => {
      const mappedName = customNames[index] || buildDefaultFrameName(namePrefix, index);
      return createFrameEntry(index, mappedName, box.x, box.y, box.w, box.h);
    });
    const dedupeResult = dedupeNames(nextFrames);
    setFrames(dedupeResult.frames);
    setSelectedFrameId(dedupeResult.frames.length > 0 ? 0 : null);
    setMessage(`自动切片完成：识别到 ${dedupeResult.frames.length} 个区域。`);
  };

  const updateFrameName = (index: number, name: string): void => {
    setFrames((prev) => prev.map((entry, idx) => {
      if (idx !== index) return entry;
      return { ...entry, name: ensurePngExt(name.trim() || buildDefaultFrameName(namePrefix, idx)) };
    }));
  };

  const patchSelectedFrame = (updater: (frame: FrameEntry) => FrameEntry): void => {
    if (selectedFrameId === null) return;
    setFrames((prev) => prev.map((entry) => (entry.id === selectedFrameId ? updater(entry) : entry)));
  };

  const commitManualDraft = (draft: Exclude<ManualDraft, null>): void => {
    const x = Math.min(draft.startX, draft.currentX);
    const y = Math.min(draft.startY, draft.currentY);
    const w = Math.abs(draft.currentX - draft.startX);
    const h = Math.abs(draft.currentY - draft.startY);
    appendFrame(x, y, w, h, '手动');
  };

  const commitPolygonDraft = (): void => {
    if (polygonDraft.length < 3) {
      setMessage('不规则模式至少需要 3 个点。');
      return;
    }
    const xs = polygonDraft.map((item) => item.x);
    const ys = polygonDraft.map((item) => item.y);
    const minX = Math.min(...xs);
    const minY = Math.min(...ys);
    const maxX = Math.max(...xs);
    const maxY = Math.max(...ys);
    appendFrame(minX, minY, maxX - minX, maxY - minY, '不规则');
    setPolygonDraft([]);
  };

  const handlePreviewMouseDown = (event: React.MouseEvent<HTMLDivElement>): void => {
    if (!imageSrc || mode !== 'manual') return;
    if (event.button !== 0) return;
    const { x, y } = getImageCoordinate(event);
    setManualDraft({ startX: x, startY: y, currentX: x, currentY: y });
  };

  const handlePreviewMouseMove = (event: React.MouseEvent<HTMLDivElement>): void => {
    if (!manualDraft) return;
    const { x, y } = getImageCoordinate(event);
    setManualDraft((prev) => (prev ? { ...prev, currentX: x, currentY: y } : prev));
  };

  const handlePreviewMouseUp = (): void => {
    if (!manualDraft) return;
    commitManualDraft(manualDraft);
    setManualDraft(null);
  };

  const handlePreviewMouseLeave = (): void => {
    if (!manualDraft) return;
    commitManualDraft(manualDraft);
    setManualDraft(null);
  };

  const handlePreviewClick = (event: React.MouseEvent<HTMLDivElement>): void => {
    if (!imageSrc || manualDraft) return;
    const { x, y } = getImageCoordinate(event);

    if (mode === 'irregular') {
      setPolygonDraft((prev) => [...prev, { x, y }]);
      return;
    }

    const frameId = findFrameIdByPoint(x, y);
    setSelectedFrameId(frameId);
    if (frameId === null) {
      setMessage('未选中切片。');
    } else {
      setMessage(`已选中切片 #${frameId + 1}`);
    }
  };

  const handlePreviewDoubleClick = (): void => {
    if (mode !== 'irregular') return;
    commitPolygonDraft();
  };

  const handlePreviewContextMenu = (event: React.MouseEvent<HTMLDivElement>): void => {
    if (mode !== 'irregular') return;
    event.preventDefault();
    commitPolygonDraft();
  };

  const deleteSelectedFrame = (): void => {
    if (selectedFrameId === null) {
      setMessage('请先选择要删除的切片。');
      return;
    }
    setFrames((prev) => prev.filter((item) => item.id !== selectedFrameId).map((item, index) => ({ ...item, id: index })));
    setSelectedFrameId(null);
    setMessage('已删除选中切片。');
  };

  const undoLastFrame = (): void => {
    setFrames((prev) => {
      if (prev.length === 0) return prev;
      return prev.slice(0, -1).map((item, index) => ({ ...item, id: index }));
    });
    setSelectedFrameId(null);
    setMessage('已撤销最后一个切片。');
  };

  const clearAllFrames = (): void => {
    setFrames([]);
    setSelectedFrameId(null);
    setPolygonDraft([]);
    setManualDraft(null);
    setMessage('已清空所有切片。');
  };

  const copyJson = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(atlasJsonText);
      setMessage('JSON 已复制到剪贴板。');
    } catch {
      setMessage('复制失败，请手动复制。');
    }
  };

  const downloadJson = (): void => {
    const normalizedJsonPath = normalizeResourcePath(atlasJsonPath);
    const jsonFileName =
      (normalizedJsonPath.split('/').pop() || imageFileName.replace(/\.[^/.]+$/, '') || 'atlas')
        .replace(/\.json$/i, '');
    const blob = new Blob([atlasJsonText], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${jsonFileName}.json`;
    link.click();
    URL.revokeObjectURL(url);
    setMessage(`已下载 ${jsonFileName}.json`);
  };

  const saveJsonToProject = async (): Promise<void> => {
    const normalizedPath = normalizeResourcePath(atlasJsonPath);
    if (!normalizedPath) {
      setMessage('请先填写 atlas JSON 路径。');
      return;
    }
    setSaving(true);
    try {
      const response = await requestDevServer('/api/atlas-json', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          path: normalizedPath,
          data: generatedAtlas
        })
      });
      const rawText = await response.text();
      let result: { success?: boolean; message?: string; publicPath?: string } = {};
      if (rawText.trim()) {
        try {
          result = JSON.parse(rawText) as { success?: boolean; message?: string; publicPath?: string };
        } catch {
          // keep fallback below
        }
      }
      if (!response.ok || !result.success) {
        const fallback = rawText.trim() ? rawText.trim().slice(0, 160) : `HTTP ${response.status}`;
        setMessage(`保存失败：${result.message || fallback}`);
        return;
      }
      const savedPath = result.publicPath || normalizedPath;
      setAtlasJsonPath(savedPath);
      setMessage(`已保存：${savedPath}`);
    } catch (error) {
      setMessage(`保存失败：${String(error)}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '420px 1fr', height: '100vh', padding: 12, gap: 12, background: '#0f1318', color: '#eaf0f8' }}>
      <aside style={{ background: '#1b222d', border: '1px solid #2b3546', borderRadius: 10, padding: 12, overflow: 'auto' }}>
        <h2 style={{ margin: 0, marginBottom: 8 }}>Atlas JSON 编辑器</h2>
        <div style={{ fontSize: 12, color: '#9eb0c7', marginBottom: 12 }}>
          支持：手动框选、网格切分、不规则点选；可加载并编辑现有 atlas JSON。
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 10 }}>
          <button onClick={() => setMode('manual')} style={{ background: mode === 'manual' ? '#334765' : undefined }}>手动框选</button>
          <button onClick={() => setMode('grid')} style={{ background: mode === 'grid' ? '#334765' : undefined }}>网格切分</button>
          <button onClick={() => setMode('irregular')} style={{ background: mode === 'irregular' ? '#334765' : undefined }}>不规则</button>
        </div>

        <label style={{ display: 'block', marginBottom: 6, fontSize: 13 }}>加载已有 Atlas JSON（public 相对路径）</label>
        <select
          value={atlasJsonPath}
          onChange={(event) => {
            const nextPath = event.target.value;
            setAtlasJsonPath(nextPath);
            void loadAtlasFromPath(nextPath);
          }}
          style={{ width: '100%', marginBottom: 8 }}
        >
          <option value="" disabled>-- 请选择 Atlas JSON --</option>
          {RESOURCE_ATLAS_JSON_OPTIONS.map((path) => (
            <option key={path} value={path}>
              {path}
            </option>
          ))}
        </select>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 86px', gap: 8, marginBottom: 8 }}>
          <input value={atlasJsonPath} onChange={(event) => setAtlasJsonPath(event.target.value)} placeholder="resources/左下小人图集.json" />
          <button onClick={() => void loadAtlasFromPath()}>加载</button>
        </div>
        <label style={{ display: 'block', marginBottom: 10, fontSize: 12, color: '#9eb0c7' }}>
          或上传 JSON 文件
          <input type="file" accept="application/json,.json" onChange={handleAtlasFileUpload} style={{ display: 'block', marginTop: 6 }} />
        </label>

        <label style={{ display: 'block', marginBottom: 6, fontSize: 13 }}>上传图集图片</label>
        <input type="file" accept="image/png,image/jpeg,image/webp" onChange={handleImageUpload} style={{ marginBottom: 10 }} />

        <label style={{ display: 'block', marginBottom: 6, fontSize: 13 }}>从 public 路径加载图集图片</label>
        <select
          value={imageResourcePath}
          onChange={(event) => {
            const nextPath = event.target.value;
            setImageResourcePath(nextPath);
            void loadImageFromResourcePath(nextPath);
          }}
          style={{ width: '100%', marginBottom: 8 }}
        >
          <option value="">-- 请选择图片（选择后自动加载）--</option>
          {RESOURCE_IMAGE_OPTIONS.map((path) => <option key={path} value={path}>{path}</option>)}
        </select>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 86px', gap: 8, marginBottom: 10 }}>
          <input
            value={imageResourcePath}
            onChange={(event) => setImageResourcePath(event.target.value)}
            placeholder="resources/原始位置信息保留——腿部_手部.png"
          />
          <button onClick={() => void loadImageFromResourcePath()}>加载</button>
        </div>

        <label style={{ display: 'block', marginBottom: 6, fontSize: 13 }}>meta.image（图集文件名）</label>
        <input value={imageFileName} onChange={(event) => setImageFileName(event.target.value)} style={{ width: '100%', marginBottom: 10 }} />

        <label style={{ display: 'block', marginBottom: 6, fontSize: 13 }}>默认命名前缀</label>
        <input value={namePrefix} onChange={(event) => setNamePrefix(event.target.value)} style={{ width: '100%', marginBottom: 10 }} />

        {mode === 'grid' ? (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
              <button onClick={() => setGridSplitMode('cell-size')} style={{ background: gridSplitMode === 'cell-size' ? '#334765' : undefined }}>
                尺寸 / 间隔
              </button>
              <button onClick={() => setGridSplitMode('rows-columns')} style={{ background: gridSplitMode === 'rows-columns' ? '#334765' : undefined }}>
                仅行列（跳过空格）
              </button>
            </div>
            {gridSplitMode === 'cell-size' ? <>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
              <label style={{ fontSize: 13 }}>
                帧宽（0=自动）
                <input type="number" value={frameWidth} min={0} onChange={(event) => setFrameWidth(toInt(event.target.value))} style={{ width: '100%' }} />
              </label>
              <label style={{ fontSize: 13 }}>
                帧高（0=自动）
                <input type="number" value={frameHeight} min={0} onChange={(event) => setFrameHeight(toInt(event.target.value))} style={{ width: '100%' }} />
              </label>
              <label style={{ fontSize: 13 }}>
                起点 X
                <input type="number" value={startX} min={0} onChange={(event) => setStartX(toInt(event.target.value))} style={{ width: '100%' }} />
              </label>
              <label style={{ fontSize: 13 }}>
                起点 Y
                <input type="number" value={startY} min={0} onChange={(event) => setStartY(toInt(event.target.value))} style={{ width: '100%' }} />
              </label>
              <label style={{ fontSize: 13 }}>
                间隔 X
                <input type="number" value={gapX} min={0} onChange={(event) => setGapX(toInt(event.target.value))} style={{ width: '100%' }} />
              </label>
              <label style={{ fontSize: 13 }}>
                间隔 Y
                <input type="number" value={gapY} min={0} onChange={(event) => setGapY(toInt(event.target.value))} style={{ width: '100%' }} />
              </label>
              <label style={{ fontSize: 13 }}>
                列数（0=自动）
                <input type="number" value={columnCount} min={0} onChange={(event) => setColumnCount(toInt(event.target.value))} style={{ width: '100%' }} />
              </label>
              <label style={{ fontSize: 13 }}>
                行数（0=自动）
                <input type="number" value={rowCount} min={0} onChange={(event) => setRowCount(toInt(event.target.value))} style={{ width: '100%' }} />
              </label>
              </div>
              <label style={{ display: 'block', marginBottom: 8, fontSize: 13 }}>
                最大数量（0=不限）
                <input type="number" value={maxCount} min={0} onChange={(event) => setMaxCount(toInt(event.target.value))} style={{ width: '100%' }} />
              </label>
            </> : <>
              <div style={{ padding: '8px 10px', marginBottom: 8, borderRadius: 7, background: '#121923', color: '#9eb0c7', fontSize: 12 }}>
                整张图片会按行列均分。每格使用下方 Alpha 阈值扫描，完全没有可见像素的格子不会生成帧。
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
                <label style={{ fontSize: 13 }}>
                  列数
                  <input type="number" value={columnCount} min={1} onChange={(event) => setColumnCount(toInt(event.target.value))} style={{ width: '100%' }} />
                </label>
                <label style={{ fontSize: 13 }}>
                  行数
                  <input type="number" value={rowCount} min={1} onChange={(event) => setRowCount(toInt(event.target.value))} style={{ width: '100%' }} />
                </label>
              </div>
            </>}
            <div style={{ marginBottom: 10, padding: '8px 10px', borderRadius: 7, background: gridEstimate.valid ? '#173527' : '#3a2428', color: gridEstimate.valid ? '#9be0b3' : '#f0a9aa', fontSize: 12 }}>
              {gridEstimate.message}
            </div>
          </>
        ) : null}

        <div style={{ border: '1px solid #2b3546', borderRadius: 8, padding: 8, marginBottom: 10 }}>
          <div style={{ fontSize: 12, color: '#9eb0c7', marginBottom: 6 }}>自动切片（透明像素识别）</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <label style={{ fontSize: 12 }}>
              Alpha 阈值
              <input
                type="number"
                min={1}
                max={255}
                value={autoAlphaThreshold}
                onChange={(event) => setAutoAlphaThreshold(clamp(toInt(event.target.value), 1, 255))}
                style={{ width: '100%' }}
              />
            </label>
            <label style={{ fontSize: 12 }}>
              最小像素面积
              <input
                type="number"
                min={1}
                value={autoMinPixelArea}
                onChange={(event) => setAutoMinPixelArea(Math.max(1, toInt(event.target.value)))}
                style={{ width: '100%' }}
              />
            </label>
          </div>
          <button style={{ marginTop: 8, width: '100%' }} onClick={() => void autoSliceFrames()}>
            一键自动切片
          </button>
        </div>

        {mode === 'manual' ? (
          <div style={{ fontSize: 12, color: '#9eb0c7', marginBottom: 10 }}>
            手动模式：按住鼠标左键拖拽创建切片；点击已有框可选中。
          </div>
        ) : null}

        {mode === 'irregular' ? (
          <div style={{ marginBottom: 10, fontSize: 12, color: '#9eb0c7' }}>
            不规则模式：左键逐点描边，双击或右键完成；会按多边形外接矩形写入 atlas。
          </div>
        ) : null}

        <label style={{ display: 'block', marginBottom: 6, fontSize: 13 }}>按行提供帧名（可选，顺序映射）</label>
        <textarea
          value={nameLinesText}
          onChange={(event) => setNameLinesText(event.target.value)}
          placeholder={'例如：\n左下小人-后头部\n左下小人-前头部'}
          style={{ width: '100%', minHeight: 100, resize: 'vertical', marginBottom: 10 }}
        />

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
          <button onClick={() => void generateFrames()} disabled={mode !== 'grid'}>
            {mode === 'grid' && gridEstimate.valid
              ? gridSplitMode === 'rows-columns'
                ? `扫描并生成最多 ${gridEstimate.count} 个切片`
                : `生成 ${gridEstimate.count} 个网格切片`
              : '生成网格切片'}
          </button>
          <button onClick={() => void saveJsonToProject()} disabled={saving}>
            {saving ? '保存中…' : '保存到项目'}
          </button>
          <button onClick={() => void copyJson()}>复制 JSON</button>
          <button onClick={downloadJson}>下载 JSON</button>
          <button onClick={clearAllFrames}>清空切片</button>
          <button onClick={deleteSelectedFrame} disabled={selectedFrameId === null}>删除选中</button>
          <button onClick={undoLastFrame} disabled={frames.length === 0}>撤销最后一个</button>
          <button onClick={commitPolygonDraft} disabled={mode !== 'irregular' || polygonDraft.length < 3}>完成不规则</button>
          <button onClick={() => setPolygonDraft([])} disabled={polygonDraft.length === 0}>清空不规则草稿</button>
        </div>

        {selectedFrame ? (
          <div style={{ border: '1px solid #2b3546', borderRadius: 8, padding: 8, marginBottom: 10 }}>
            <div style={{ fontSize: 12, color: '#9eb0c7', marginBottom: 6 }}>选中切片属性</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <label style={{ fontSize: 12 }}>
                X
                <input
                  type="number"
                  value={selectedFrame.x}
                  onChange={(event) => patchSelectedFrame((frame) => ({ ...frame, x: Math.max(0, toInt(event.target.value)) }))}
                />
              </label>
              <label style={{ fontSize: 12 }}>
                Y
                <input
                  type="number"
                  value={selectedFrame.y}
                  onChange={(event) => patchSelectedFrame((frame) => ({ ...frame, y: Math.max(0, toInt(event.target.value)) }))}
                />
              </label>
              <label style={{ fontSize: 12 }}>
                W
                <input
                  type="number"
                  min={1}
                  value={selectedFrame.w}
                  onChange={(event) => patchSelectedFrame((frame) => ({ ...frame, w: clampPositive(toInt(event.target.value), frame.w) }))}
                />
              </label>
              <label style={{ fontSize: 12 }}>
                H
                <input
                  type="number"
                  min={1}
                  value={selectedFrame.h}
                  onChange={(event) => patchSelectedFrame((frame) => ({ ...frame, h: clampPositive(toInt(event.target.value), frame.h) }))}
                />
              </label>
              <label style={{ fontSize: 12 }}>
                Pivot X
                <input
                  type="number"
                  step={0.01}
                  value={selectedFrame.pivot?.x ?? 0.5}
                  onChange={(event) => patchSelectedFrame((frame) => ({ ...frame, pivot: { x: toFloat(event.target.value, 0.5), y: frame.pivot?.y ?? 0.5 } }))}
                />
              </label>
              <label style={{ fontSize: 12 }}>
                Pivot Y
                <input
                  type="number"
                  step={0.01}
                  value={selectedFrame.pivot?.y ?? 0.5}
                  onChange={(event) => patchSelectedFrame((frame) => ({ ...frame, pivot: { x: frame.pivot?.x ?? 0.5, y: toFloat(event.target.value, 0.5) } }))}
                />
              </label>
            </div>
            <label style={{ display: 'block', marginTop: 6, fontSize: 12 }}>
              <input
                type="checkbox"
                checked={selectedFrame.rotated}
                onChange={(event) => patchSelectedFrame((frame) => ({ ...frame, rotated: event.target.checked }))}
              />{' '}
              rotated
            </label>
          </div>
        ) : null}

        <div style={{ marginBottom: 10, fontSize: 12, color: '#9eb0c7' }}>{message}</div>

        <div style={{ borderTop: '1px solid #2b3546', paddingTop: 8 }}>
          <div style={{ marginBottom: 6, fontSize: 12, color: '#9eb0c7' }}>切片列表（可改名）：{frames.length}</div>
          <div style={{ maxHeight: 220, overflow: 'auto', border: '1px solid #2b3546', borderRadius: 6, padding: 8 }}>
            {frames.length === 0 ? (
              <div style={{ fontSize: 12, color: '#7f8fa5' }}>暂无切片</div>
            ) : (
              frames.map((entry, index) => (
                <div key={entry.id} style={{ display: 'grid', gridTemplateColumns: '40px 1fr', gap: 6, marginBottom: 6 }}>
                  <span
                    onClick={() => setSelectedFrameId(entry.id)}
                    style={{ fontSize: 11, color: selectedFrameId === entry.id ? '#7fb1ff' : '#8a9bb0', lineHeight: '26px', cursor: 'pointer' }}
                    title={selectedFrameId === entry.id ? '当前选中' : '点击选中'}
                  >
                    {index + 1}
                  </span>
                  <input value={entry.name} onChange={(event) => updateFrameName(index, event.target.value)} />
                </div>
              ))
            )}
          </div>
        </div>
      </aside>

      <main style={{ background: '#111823', border: '1px solid #2b3546', borderRadius: 10, padding: 12, overflow: 'auto' }}>
        <div style={{ marginBottom: 10, fontSize: 12, color: '#a0b3c8' }}>
          图集尺寸：{imageWidth || '-'} x {imageHeight || '-'}，预览缩放：{(previewRatio * 100).toFixed(1)}%，模式：{mode}
        </div>
        {imageSrc ? (
          <div
            style={{ position: 'relative', width: imageWidth * previewRatio, height: imageHeight * previewRatio, border: '1px solid #2f3a4d', borderRadius: 6, overflow: 'hidden', cursor: mode === 'manual' || mode === 'irregular' ? 'crosshair' : 'default' }}
            onMouseDown={handlePreviewMouseDown}
            onMouseMove={handlePreviewMouseMove}
            onMouseUp={handlePreviewMouseUp}
            onMouseLeave={handlePreviewMouseLeave}
            onClick={handlePreviewClick}
            onDoubleClick={handlePreviewDoubleClick}
            onContextMenu={handlePreviewContextMenu}
          >
            <img src={imageSrc} alt="atlas-preview" style={{ width: imageWidth * previewRatio, height: imageHeight * previewRatio, display: 'block' }} />
            <svg width={imageWidth * previewRatio} height={imageHeight * previewRatio} style={{ position: 'absolute', left: 0, top: 0, pointerEvents: 'none' }}>
              {frames.map((entry, index) => (
                <g key={entry.id}>
                  <rect
                    x={entry.x * previewRatio}
                    y={entry.y * previewRatio}
                    width={entry.w * previewRatio}
                    height={entry.h * previewRatio}
                    fill={selectedFrameId === entry.id ? 'rgba(255, 200, 87, 0.28)' : 'rgba(78, 149, 255, 0.16)'}
                    stroke={selectedFrameId === entry.id ? 'rgba(255, 208, 112, 0.98)' : 'rgba(104, 171, 255, 0.95)'}
                    strokeWidth={selectedFrameId === entry.id ? 2 : 1}
                  />
                  <text x={entry.x * previewRatio + 6} y={entry.y * previewRatio + 16} fill="#ecf4ff" fontSize={11} fontFamily="Segoe UI, Microsoft YaHei, sans-serif">
                    {index + 1}{entry.rotated ? 'R' : ''}
                  </text>
                </g>
              ))}
              {manualDraft ? (
                <rect
                  x={Math.min(manualDraft.startX, manualDraft.currentX) * previewRatio}
                  y={Math.min(manualDraft.startY, manualDraft.currentY) * previewRatio}
                  width={Math.abs(manualDraft.currentX - manualDraft.startX) * previewRatio}
                  height={Math.abs(manualDraft.currentY - manualDraft.startY) * previewRatio}
                  fill="rgba(112, 255, 190, 0.15)"
                  stroke="rgba(117, 255, 192, 0.95)"
                  strokeDasharray="4 3"
                  strokeWidth={1}
                />
              ) : null}
              {polygonDraft.length > 0 ? (
                <>
                  <polyline
                    points={polygonDraft.map((p) => `${p.x * previewRatio},${p.y * previewRatio}`).join(' ')}
                    fill="rgba(255, 144, 105, 0.12)"
                    stroke="rgba(255, 156, 120, 0.95)"
                    strokeWidth={1.5}
                  />
                  {polygonDraft.map((point, idx) => (
                    <circle key={`${point.x}-${point.y}-${idx}`} cx={point.x * previewRatio} cy={point.y * previewRatio} r={3} fill="#ffb089" />
                  ))}
                </>
              ) : null}
            </svg>
          </div>
        ) : (
          <div style={{ fontSize: 13, color: '#7f8fa5' }}>请先加载图像。</div>
        )}

        <div style={{ marginTop: 12 }}>
          <label style={{ display: 'block', marginBottom: 6, fontSize: 13, color: '#9eb0c7' }}>JSON 预览</label>
          <textarea
            value={atlasJsonText}
            readOnly
            style={{ width: '100%', minHeight: 260, background: '#0c1118', color: '#cce0ff', border: '1px solid #2b3546', borderRadius: 6, padding: 8, resize: 'vertical' }}
          />
        </div>
      </main>
    </div>
  );
};
