import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  createEmptyClip,
  createEmptyPart,
  createEmptyRig,
  fetchSpriteAnimationServerConnection,
  getAtlasFrameNames,
  getLastAnimClipId,
  getLastAnimRigId,
  getSpriteAnimationLibrary,
  hydrateSpriteAnimationLibrary,
  joinPublicPath,
  loadTexturePackerAtlas,
  normalizePublicPath,
  reloadSpriteAnimationLibrary,
  resolvePartAtlas,
  saveLastAnimClipId,
  saveLastAnimRigId,
  saveSpriteAnimationLibrary,
  type SpriteAnimClip,
  type SpriteAnimationLibrary,
  type SpritePartDef,
  type SpriteRigDef
} from '@/core/sprite';

interface UseLibraryManagementResult {
  message: string;
  setMessage: (message: string) => void;
  serverConnected: boolean;
  serverPort: number | null;
  library: SpriteAnimationLibrary;
  rig: SpriteRigDef | null;
  clip: SpriteAnimClip | null;
  /** 当前选中部件可用的帧名（按部件图集） */
  frameNames: string[];
  selectedPartId: string;
  selectedKeyTime: number;
  selectedKeyTimes: number[];
  setSelectedPartId: (partId: string) => void;
  setSelectedKeyTime: (time: number) => void;
  selectKeyTime: (time: number, multi?: boolean) => void;
  clearKeySelection: () => void;
  selectRig: (rigId: string) => void;
  selectClip: (clipId: string) => void;
  updateRig: (updater: (prev: SpriteRigDef) => SpriteRigDef) => void;
  updateClip: (updater: (prev: SpriteAnimClip) => SpriteAnimClip) => void;
  updateSelectedPart: (updater: (prev: SpritePartDef) => SpritePartDef) => void;
  movePart: (fromPartId: string, toPartId: string) => void;
  undo: () => void;
  canUndo: boolean;
  redo: () => void;
  canRedo: boolean;
  addPart: () => void;
  removeSelectedPart: () => void;
  addClip: () => void;
  loadAtlasIntoRig: (atlasJsonPath: string) => Promise<void>;
  loadAtlasIntoSelectedPart: (atlasJsonPath: string) => Promise<void>;
  clearSelectedPartAtlasOverride: () => void;
  saveLibrary: () => Promise<void>;
  retryServerConnection: () => Promise<void>;
}

export const useLibraryManagement = (): UseLibraryManagementResult => {
  type UndoSnapshot = {
    library: SpriteAnimationLibrary;
    activeRigId: string;
    activeClipId: string;
    selectedPartId: string;
    selectedKeyTimes: number[];
  };

  const cloneLibrary = (input: SpriteAnimationLibrary): SpriteAnimationLibrary => {
    if (typeof structuredClone === 'function') {
      return structuredClone(input);
    }
    return JSON.parse(JSON.stringify(input)) as SpriteAnimationLibrary;
  };

  const [message, setMessage] = useState('正在加载动画库…');
  const [serverConnected, setServerConnected] = useState(false);
  const [serverPort, setServerPort] = useState<number | null>(null);
  const [library, setLibrary] = useState<SpriteAnimationLibrary>({ rigs: {}, clips: {} });
  const [activeRigId, setActiveRigId] = useState('');
  const [activeClipId, setActiveClipId] = useState('');
  const [atlasFramesCache, setAtlasFramesCache] = useState<Record<string, string[]>>({});
  const [selectedPartId, setSelectedPartId] = useState('');
  const [selectedKeyTimes, setSelectedKeyTimes] = useState<number[]>([0]);
  const undoStackRef = useRef<UndoSnapshot[]>([]);
  const redoStackRef = useRef<UndoSnapshot[]>([]);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const activeRigIdRef = useRef(activeRigId);
  const activeClipIdRef = useRef(activeClipId);
  const selectedPartIdRef = useRef(selectedPartId);
  const selectedKeyTimesRef = useRef(selectedKeyTimes);

  useEffect(() => {
    activeRigIdRef.current = activeRigId;
    activeClipIdRef.current = activeClipId;
    selectedPartIdRef.current = selectedPartId;
    selectedKeyTimesRef.current = selectedKeyTimes;
  }, [activeRigId, activeClipId, selectedPartId, selectedKeyTimes]);

  const createSnapshot = useCallback((librarySnapshot: SpriteAnimationLibrary): UndoSnapshot => {
    return {
      library: cloneLibrary(librarySnapshot),
      activeRigId: activeRigIdRef.current,
      activeClipId: activeClipIdRef.current,
      selectedPartId: selectedPartIdRef.current,
      selectedKeyTimes: [...selectedKeyTimesRef.current]
    };
  }, []);

  const pushUndoSnapshot = useCallback((prevLibrary: SpriteAnimationLibrary) => {
    const snapshot: UndoSnapshot = {
      ...createSnapshot(prevLibrary)
    };
    undoStackRef.current.push(snapshot);
    if (undoStackRef.current.length > 100) {
      undoStackRef.current.splice(0, undoStackRef.current.length - 100);
    }
    redoStackRef.current = [];
    setCanUndo(true);
    setCanRedo(false);
  }, [createSnapshot]);

  const rig = library.rigs[activeRigId] ?? null;
  const clip = library.clips[activeClipId] ?? null;
  const selectedKeyTime = selectedKeyTimes[0] ?? 0;

  const selectedPart = useMemo(
    () => rig?.parts.find((part) => part.partId === selectedPartId) ?? null,
    [rig, selectedPartId]
  );

  const activeAtlasJsonPath = useMemo(() => {
    if (!rig) return '';
    if (!selectedPart) return normalizePublicPath(rig.atlasJsonPath);
    return resolvePartAtlas(rig, selectedPart).atlasJsonPath;
  }, [rig, selectedPart]);

  const frameNames = atlasFramesCache[activeAtlasJsonPath] ?? [];

  const refreshConnection = useCallback(async () => {
    const result = await fetchSpriteAnimationServerConnection();
    setServerConnected(result.connected);
    setServerPort(result.port);
  }, []);

  const ensureAtlasFrames = useCallback(async (atlasJsonPath: string) => {
    const normalized = normalizePublicPath(atlasJsonPath);
    if (!normalized) return [];
    if (atlasFramesCache[normalized]) return atlasFramesCache[normalized];
    try {
      const atlas = await loadTexturePackerAtlas(normalized);
      const names = getAtlasFrameNames(atlas);
      setAtlasFramesCache((prev) => ({ ...prev, [normalized]: names }));
      return names;
    } catch {
      setAtlasFramesCache((prev) => ({ ...prev, [normalized]: [] }));
      return [];
    }
  }, [atlasFramesCache]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await hydrateSpriteAnimationLibrary();
      if (cancelled) return;
      const next = getSpriteAnimationLibrary();
      setLibrary(next);

      const rigIds = Object.keys(next.rigs);
      const preferredRig = getLastAnimRigId();
      const nextRigId =
        (preferredRig && next.rigs[preferredRig] && preferredRig) || rigIds[0] || '';
      const clipsForRig = Object.values(next.clips).filter((item) => item.rigId === nextRigId);
      const preferredClip = getLastAnimClipId();
      const nextClipId =
        (preferredClip && next.clips[preferredClip]?.rigId === nextRigId && preferredClip) ||
        clipsForRig[0]?.clipId ||
        '';

      setActiveRigId(nextRigId);
      setActiveClipId(nextClipId);
      if (nextRigId) saveLastAnimRigId(nextRigId);
      if (nextClipId) saveLastAnimClipId(nextClipId);
      setSelectedPartId(next.rigs[nextRigId]?.parts[0]?.partId ?? '');
      setSelectedKeyTimes([next.clips[nextClipId]?.keys[0]?.time ?? 0]);

      await refreshConnection();
      setMessage('动画库已加载');
    })();
    return () => {
      cancelled = true;
    };
  }, [refreshConnection]);

  useEffect(() => {
    if (!activeAtlasJsonPath) return;
    void ensureAtlasFrames(activeAtlasJsonPath);
  }, [activeAtlasJsonPath, ensureAtlasFrames]);

  const setSelectedKeyTime = useCallback((time: number) => {
    setSelectedKeyTimes([Number(time.toFixed(4))]);
  }, []);

  const selectKeyTime = useCallback((time: number, multi = false) => {
    const rounded = Number(time.toFixed(4));
    setSelectedKeyTimes((prev) => {
      if (!multi) return [rounded];
      if (prev.some((t) => Math.abs(t - rounded) < 1e-4)) {
        const next = prev.filter((t) => Math.abs(t - rounded) >= 1e-4);
        return next.length > 0 ? next : [rounded];
      }
      return [...prev, rounded].sort((a, b) => a - b);
    });
  }, []);

  const clearKeySelection = useCallback(() => {
    setSelectedKeyTimes([clip?.keys[0]?.time ?? 0]);
  }, [clip]);

  const selectRig = useCallback((rigId: string) => {
    setActiveRigId(rigId);
    saveLastAnimRigId(rigId);
    const clipsForRig = Object.values(library.clips).filter((item) => item.rigId === rigId);
    const nextClipId = clipsForRig[0]?.clipId ?? '';
    setActiveClipId(nextClipId);
    if (nextClipId) saveLastAnimClipId(nextClipId);
    setSelectedPartId(library.rigs[rigId]?.parts[0]?.partId ?? '');
    setSelectedKeyTimes([library.clips[nextClipId]?.keys[0]?.time ?? 0]);
  }, [library]);

  const selectClip = useCallback((clipId: string) => {
    setActiveClipId(clipId);
    saveLastAnimClipId(clipId);
    setSelectedKeyTimes([library.clips[clipId]?.keys[0]?.time ?? 0]);
  }, [library]);

  const updateRig = useCallback((updater: (prev: SpriteRigDef) => SpriteRigDef) => {
    setLibrary((prev) => {
      const current = prev.rigs[activeRigId];
      if (!current) return prev;
      const nextRig = updater(current);
      if (nextRig === current) return prev;
      pushUndoSnapshot(prev);
      return {
        ...prev,
        rigs: {
          ...prev.rigs,
          [nextRig.rigId]: nextRig
        }
      };
    });
  }, [activeRigId, pushUndoSnapshot]);

  const updateClip = useCallback((updater: (prev: SpriteAnimClip) => SpriteAnimClip) => {
    setLibrary((prev) => {
      const current = prev.clips[activeClipId];
      if (!current) return prev;
      const nextClip = updater(current);
      if (nextClip === current) return prev;
      pushUndoSnapshot(prev);
      return {
        ...prev,
        clips: {
          ...prev.clips,
          [nextClip.clipId]: nextClip
        }
      };
    });
  }, [activeClipId, pushUndoSnapshot]);

  const updateSelectedPart = useCallback((updater: (prev: SpritePartDef) => SpritePartDef) => {
    updateRig((prev) => ({
      ...prev,
      parts: prev.parts.map((part) => (part.partId === selectedPartId ? updater(part) : part))
    }));
  }, [selectedPartId, updateRig]);

  const movePart = useCallback((fromPartId: string, toPartId: string) => {
    if (!rig || fromPartId === toPartId) return;
    updateRig((prev) => {
      const fromIndex = prev.parts.findIndex((part) => part.partId === fromPartId);
      const toIndex = prev.parts.findIndex((part) => part.partId === toPartId);
      if (fromIndex < 0 || toIndex < 0) return prev;
      const nextParts = [...prev.parts];
      const [moved] = nextParts.splice(fromIndex, 1);
      if (!moved) return prev;
      nextParts.splice(toIndex, 0, moved);
      return { ...prev, parts: nextParts };
    });
    setMessage(`已调整部件顺序：${fromPartId} -> ${toPartId}`);
  }, [rig, updateRig]);

  const addPart = useCallback(() => {
    if (!rig) return;
    let index = rig.parts.length + 1;
    let partId = `part_${index}`;
    const existing = new Set(rig.parts.map((part) => part.partId));
    while (existing.has(partId)) {
      index += 1;
      partId = `part_${index}`;
    }
    const part = createEmptyPart(partId, frameNames[0]);
    updateRig((prev) => ({ ...prev, parts: [...prev.parts, part] }));
    setSelectedPartId(partId);
    setMessage(`已添加部件：${partId}`);
  }, [rig, frameNames, updateRig]);

  const removeSelectedPart = useCallback(() => {
    if (!rig || rig.parts.length <= 1) {
      setMessage('至少保留一个部件');
      return;
    }
    const nextParts = rig.parts.filter((part) => part.partId !== selectedPartId);
    updateRig((prev) => ({ ...prev, parts: nextParts }));
    setSelectedPartId(nextParts[0]?.partId ?? '');
    setMessage(`已删除部件：${selectedPartId}`);
  }, [rig, selectedPartId, updateRig]);

  const addClip = useCallback(() => {
    if (!rig) return;
    const baseName = 'new_clip';
    let clipId = `${rig.rigId}/${baseName}`;
    let i = 1;
    while (library.clips[clipId]) {
      i += 1;
      clipId = `${rig.rigId}/${baseName}_${i}`;
    }
    const nextClip = createEmptyClip(
      clipId,
      rig.rigId,
      rig.parts.map((part) => part.partId)
    );
    setLibrary((prev) => {
      pushUndoSnapshot(prev);
      return {
        ...prev,
        clips: { ...prev.clips, [nextClip.clipId]: nextClip }
      };
    });
    setActiveClipId(nextClip.clipId);
    saveLastAnimClipId(nextClip.clipId);
    setSelectedKeyTimes([0]);
    setMessage(`已创建片段：${nextClip.clipId}`);
  }, [rig, library.clips, pushUndoSnapshot]);

  const applyAtlasToPaths = useCallback(async (atlasJsonPath: string) => {
    const normalized = normalizePublicPath(atlasJsonPath);
    const atlas = await loadTexturePackerAtlas(normalized);
    const names = getAtlasFrameNames(atlas);
    const imagePath = joinPublicPath(normalized, atlas.meta.image);
    setAtlasFramesCache((prev) => ({ ...prev, [normalized]: names }));
    return { normalized, imagePath, names };
  }, []);

  const loadAtlasIntoRig = useCallback(async (atlasJsonPath: string) => {
    try {
      const { normalized, imagePath, names } = await applyAtlasToPaths(atlasJsonPath);

      if (!rig) {
        const rigId = `rig_${Date.now().toString(36)}`;
        const nextRig = createEmptyRig(rigId, normalized, imagePath, names[0]);
        const nextClip = createEmptyClip(`${rigId}/idle`, rigId, ['part_1']);
        if (names[0]) {
          nextClip.keys[0].parts.part_1 = {
            ...nextClip.keys[0].parts.part_1,
            frameName: names[0]
          };
        }
        setLibrary((prev) => {
          pushUndoSnapshot(prev);
          return {
            ...prev,
            rigs: { ...prev.rigs, [nextRig.rigId]: nextRig },
            clips: { ...prev.clips, [nextClip.clipId]: nextClip }
          };
        });
        setActiveRigId(nextRig.rigId);
        setActiveClipId(nextClip.clipId);
        setSelectedPartId('part_1');
        setSelectedKeyTimes([0]);
        saveLastAnimRigId(nextRig.rigId);
        saveLastAnimClipId(nextClip.clipId);
      } else {
        updateRig((prev) => ({
          ...prev,
          atlasJsonPath: normalized,
          atlasImagePath: imagePath,
          parts: prev.parts.map((part, index) => {
            // 仅更新未覆盖部件图集的默认帧
            if (part.atlasJsonPath) return part;
            return {
              ...part,
              defaultFrameName:
                part.defaultFrameName && names.includes(part.defaultFrameName)
                  ? part.defaultFrameName
                  : names[Math.min(index, names.length - 1)]
            };
          })
        }));
      }
      setMessage(`默认图集已载入：${normalized}`);
    } catch (error) {
      setMessage(`图集加载失败：${String(error)}`);
    }
  }, [rig, updateRig, applyAtlasToPaths, pushUndoSnapshot]);

  const loadAtlasIntoSelectedPart = useCallback(async (atlasJsonPath: string) => {
    if (!rig || !selectedPartId) {
      setMessage('请先选择部件');
      return;
    }
    try {
      const { normalized, imagePath, names } = await applyAtlasToPaths(atlasJsonPath);
      updateSelectedPart((prev) => ({
        ...prev,
        atlasJsonPath: normalized,
        atlasImagePath: imagePath,
        defaultFrameName:
          prev.defaultFrameName && names.includes(prev.defaultFrameName)
            ? prev.defaultFrameName
            : names[0]
      }));
      setMessage(`部件 ${selectedPartId} 已绑定图集：${normalized}`);
    } catch (error) {
      setMessage(`部件图集加载失败：${String(error)}`);
    }
  }, [rig, selectedPartId, updateSelectedPart, applyAtlasToPaths]);

  const clearSelectedPartAtlasOverride = useCallback(() => {
    updateSelectedPart((prev) => ({
      ...prev,
      atlasJsonPath: undefined,
      atlasImagePath: undefined
    }));
    setMessage(`部件 ${selectedPartId} 已改用 Rig 默认图集`);
  }, [updateSelectedPart, selectedPartId]);

  const saveLibrary = useCallback(async () => {
    try {
      await saveSpriteAnimationLibrary(library);
      await reloadSpriteAnimationLibrary();
      await refreshConnection();
      setMessage('已保存到 config/spriteAnimationLibrary.json');
    } catch (error) {
      setMessage(String(error));
    }
  }, [library, refreshConnection]);

  const retryServerConnection = useCallback(async () => {
    const result = await fetchSpriteAnimationServerConnection();
    setServerConnected(result.connected);
    setServerPort(result.port);
    setMessage(result.connected ? `开发服务器已连接 :${result.port ?? '?'}` : '开发服务器未连接，保存将失败');
  }, []);

  const undo = useCallback(() => {
    const snapshot = undoStackRef.current.pop();
    if (!snapshot) {
      setCanUndo(false);
      setMessage('没有可撤销的操作');
      return;
    }
    const currentSnapshot = createSnapshot(library);
    redoStackRef.current.push(currentSnapshot);
    if (redoStackRef.current.length > 100) {
      redoStackRef.current.splice(0, redoStackRef.current.length - 100);
    }
    setLibrary(snapshot.library);
    setActiveRigId(snapshot.activeRigId);
    setActiveClipId(snapshot.activeClipId);
    setSelectedPartId(snapshot.selectedPartId);
    setSelectedKeyTimes(snapshot.selectedKeyTimes.length > 0 ? snapshot.selectedKeyTimes : [0]);
    setCanUndo(undoStackRef.current.length > 0);
    setCanRedo(redoStackRef.current.length > 0);
    setMessage('已撤销上一步');
  }, [createSnapshot, library]);

  const redo = useCallback(() => {
    const snapshot = redoStackRef.current.pop();
    if (!snapshot) {
      setCanRedo(false);
      setMessage('没有可重做的操作');
      return;
    }
    const currentSnapshot = createSnapshot(library);
    undoStackRef.current.push(currentSnapshot);
    if (undoStackRef.current.length > 100) {
      undoStackRef.current.splice(0, undoStackRef.current.length - 100);
    }
    setLibrary(snapshot.library);
    setActiveRigId(snapshot.activeRigId);
    setActiveClipId(snapshot.activeClipId);
    setSelectedPartId(snapshot.selectedPartId);
    setSelectedKeyTimes(snapshot.selectedKeyTimes.length > 0 ? snapshot.selectedKeyTimes : [0]);
    setCanUndo(undoStackRef.current.length > 0);
    setCanRedo(redoStackRef.current.length > 0);
    setMessage('已重做一步');
  }, [createSnapshot, library]);

  return {
    message,
    setMessage,
    serverConnected,
    serverPort,
    library,
    rig,
    clip,
    frameNames,
    selectedPartId,
    selectedKeyTime,
    selectedKeyTimes,
    setSelectedPartId,
    setSelectedKeyTime,
    selectKeyTime,
    clearKeySelection,
    selectRig,
    selectClip,
    updateRig,
    updateClip,
    updateSelectedPart,
    movePart,
    undo,
    canUndo,
    redo,
    canRedo,
    addPart,
    removeSelectedPart,
    addClip,
    loadAtlasIntoRig,
    loadAtlasIntoSelectedPart,
    clearSelectedPartAtlasOverride,
    saveLibrary,
    retryServerConnection
  };
};
