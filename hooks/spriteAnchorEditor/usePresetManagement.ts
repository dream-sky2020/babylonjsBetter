import { useCallback, useEffect, useRef, useState } from 'react';
import {
  fetchSpritePresetServerConnection,
  hydrateSpriteAnchorPresetStorage,
  reloadSpriteAnchorPresetStorage,
  fetchSpritePresetValidationReport,
  getAllSpriteAnchorPresets,
  getLocalSpriteAnchorPreset,
  removeSpriteAnchorPreset,
  saveSpriteAnchorPreset,
  ANCHOR_MAX,
  ANCHOR_MIN,
  BOUNDS_MAX,
  BOUNDS_MIN,
  clamp,
  clamp01,
  createEditablePreset,
  getPresetSourceLabel,
  toFixedNumber,
  type DragTarget,
  type SpriteAnchorPreset,
  type SpriteFrameRegion
} from '@/core/sprite';

type AtlasFrameRegion = SpriteFrameRegion & { atlasPath: string; atlasImagePath: string };

interface UsePresetManagementParams {
  initialImagePath: string;
}

interface UsePresetManagementResult {
  preset: SpriteAnchorPreset;
  presetRef: React.MutableRefObject<SpriteAnchorPreset>;
  message: string;
  validationStatus: 'valid' | 'invalid' | 'unreachable' | 'unknown';
  validationErrors: string[];
  validationMessage: string;
  serverConnected: boolean;
  serverPort: number | null;
  retryServerConnection: () => void;
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

const normalizePresetForCompare = (value: SpriteAnchorPreset | null | undefined): unknown => {
  if (!value) return null;
  return {
    presetKey: value.presetKey,
    imagePath: value.imagePath,
    frameName: value.frameName ?? null,
    bodyBounds: value.bodyBounds,
    bodyAxisX: value.bodyAxisX,
    anchors: value.anchors,
    atlasFrame: value.atlasFrame ?? null
  };
};

const collectDiffPaths = (beforeValue: unknown, afterValue: unknown, prefix = ''): string[] => {
  if (beforeValue === afterValue) return [];
  const beforeIsObj = typeof beforeValue === 'object' && beforeValue !== null;
  const afterIsObj = typeof afterValue === 'object' && afterValue !== null;
  if (!beforeIsObj || !afterIsObj) {
    return [prefix || '(root)'];
  }

  const beforeRecord = beforeValue as Record<string, unknown>;
  const afterRecord = afterValue as Record<string, unknown>;
  const allKeys = new Set([...Object.keys(beforeRecord), ...Object.keys(afterRecord)]);
  const result: string[] = [];
  allKeys.forEach((key) => {
    result.push(...collectDiffPaths(beforeRecord[key], afterRecord[key], prefix ? `${prefix}.${key}` : key));
  });
  return result;
};

export const usePresetManagement = ({ initialImagePath }: UsePresetManagementParams): UsePresetManagementResult => {
  const [preset, setPreset] = useState<SpriteAnchorPreset>(() => createEditablePreset(initialImagePath));
  const presetRef = useRef<SpriteAnchorPreset>(createEditablePreset(initialImagePath));
  const [message, setMessage] = useState('');
  const [validationStatus, setValidationStatus] = useState<'valid' | 'invalid' | 'unreachable' | 'unknown'>('unknown');
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [validationMessage, setValidationMessage] = useState('');
  const [serverConnected, setServerConnected] = useState(false);
  const [serverPort, setServerPort] = useState<number | null>(null);
  const serverProbeInFlightRef = useRef(false);
  const serverProbeFailureCountRef = useRef(0);
  const [presetSourceLabel, setPresetSourceLabel] = useState('当前配置来源：默认模板（尚未写入 JSON）');
  const [presetKeys, setPresetKeys] = useState<string[]>(() => Object.keys(getAllSpriteAnchorPresets()).sort());

  const refreshServerConnection = useCallback(async () => {
    if (serverProbeInFlightRef.current) return;
    serverProbeInFlightRef.current = true;
    const status = await fetchSpritePresetServerConnection();
    if (status.connected) {
      serverProbeFailureCountRef.current = 0;
      setServerConnected(true);
      setServerPort(status.port);
    } else {
      serverProbeFailureCountRef.current += 1;
      if (serverProbeFailureCountRef.current >= 2) {
        setServerConnected(false);
        setServerPort(null);
      }
    }
    serverProbeInFlightRef.current = false;
  }, []);

  const refreshValidationStatus = useCallback(async (): Promise<{
    status: 'valid' | 'invalid' | 'unreachable' | 'unknown';
    errors: string[];
    message: string;
  }> => {
    const report = await fetchSpritePresetValidationReport();
    if (!report.reachable) {
      setValidationStatus('unreachable');
      setValidationErrors([]);
      setValidationMessage(report.message || '无法连接校验接口');
      return {
        status: 'unreachable',
        errors: [],
        message: report.message || '无法连接校验接口'
      };
    }

    if (report.valid) {
      setValidationStatus('valid');
      setValidationErrors([]);
      setValidationMessage('配置文件校验通过');
      return {
        status: 'valid',
        errors: [],
        message: '配置文件校验通过'
      };
    }

    const trimmedErrors = report.errors.slice(0, 12);
    const msg = report.message || `配置文件校验失败（${report.errors.length} 条）`;
    setValidationStatus('invalid');
    setValidationErrors(trimmedErrors);
    setValidationMessage(msg);
    return {
      status: 'invalid',
      errors: trimmedErrors,
      message: msg
    };
  }, []);

  useEffect(() => {
    presetRef.current = preset;
  }, [preset, refreshValidationStatus]);

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
      await refreshValidationStatus();
    })();
    return () => {
      cancelled = true;
    };
  }, [refreshValidationStatus]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      void refreshServerConnection();
    }, 3000);
    return () => {
      window.clearInterval(timer);
    };
  }, [refreshServerConnection]);

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
      setMessage(`该资源暂无配置文件记录：${activePresetKey}`);
      return;
    }
    setPreset({
      ...localPreset,
      presetKey: activePresetKey,
      imagePath: activeImagePath || imagePath,
      frameName: activeFrameName
    });
    setPresetSourceLabel('当前配置来源：项目配置(JSON)');
    setMessage(`已从配置文件导入：${activePresetKey}`);
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
    void (async () => {
      try {
        await saveSpriteAnchorPreset({
          ...preset,
          presetKey: activePresetKey,
          imagePath: saveImagePath,
          frameName: activeFrameName
        });
        await reloadSpriteAnchorPresetStorage();
        const reloadedPreset = getLocalSpriteAnchorPreset(activePresetKey);
        const draftPreset: SpriteAnchorPreset = {
          ...preset,
          presetKey: activePresetKey,
          imagePath: saveImagePath,
          frameName: activeFrameName
        };
        const beforeData = normalizePresetForCompare(draftPreset);
        const afterData = normalizePresetForCompare(reloadedPreset);
        const diffPaths = collectDiffPaths(beforeData, afterData).filter((path) => path !== '(root)');
        const diffSummary = diffPaths.length > 0
          ? `；校验修正字段：${diffPaths.slice(0, 6).join(', ')}${diffPaths.length > 6 ? ' ...' : ''}`
          : '；内容与提交一致';

        setPresetKeys(Object.keys(getAllSpriteAnchorPresets()).sort());
        setPresetSourceLabel(getPresetSourceLabel(activePresetKey));
        if (reloadedPreset) {
          setPreset((prev) => ({
            ...reloadedPreset,
            presetKey: activePresetKey,
            imagePath: saveImagePath || prev.imagePath,
            frameName: activeFrameName
          }));
        }
        const validation = await refreshValidationStatus();
        const validationSummary = validation.status === 'invalid'
          ? `；校验失败 ${validation.errors.length} 条（见下方）`
          : validation.status === 'valid'
            ? '；校验通过'
            : `；校验状态未知：${validation.message}`;
        setMessage(`已写入并重载 config/spriteAnchorPresets.json：${activePresetKey}${diffSummary}${validationSummary}`);
      } catch (error) {
        setMessage(`写入配置文件失败，请确认 python/server.py 已启动：${String(error)}`);
      }
    })();
  }, [preset, refreshValidationStatus]);

  const clearCurrentPreset = useCallback((
    activePresetKey: string,
    activeImagePath: string,
    imagePath: string,
    activeFrameName?: string,
    currentFrameRegion?: AtlasFrameRegion | null
  ) => {
    const clearImagePath = activeImagePath || imagePath;
    void (async () => {
      try {
        await removeSpriteAnchorPreset(activePresetKey);
        await reloadSpriteAnchorPresetStorage();
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
        setPresetSourceLabel('当前配置来源：默认模板（尚未写入 JSON）');
        const validation = await refreshValidationStatus();
        const validationSummary = validation.status === 'invalid'
          ? `；校验失败 ${validation.errors.length} 条（见下方）`
          : validation.status === 'valid'
            ? '；校验通过'
            : `；校验状态未知：${validation.message}`;
        setMessage(`已从配置文件移除：${activePresetKey}${validationSummary}`);
      } catch (error) {
        setMessage(`删除配置失败，请确认 python/server.py 已启动：${String(error)}`);
      }
    })();
  }, [refreshValidationStatus]);

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
    validationStatus,
    validationErrors,
    validationMessage,
    serverConnected,
    serverPort,
    retryServerConnection: () => { void refreshServerConnection(); },
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
