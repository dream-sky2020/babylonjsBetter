import { useCallback, useEffect, useRef, useState } from 'react';
import type { MutableRefObject } from 'react';
import type { ArcRotateCamera, Scene } from '@babylonjs/core';
import {
  createCompositeSprite,
  createOnionSkinController,
  createSpriteAnimPlayer,
  getClipDuration,
  loadRigAtlases,
  toFixedNumber,
  type AtlasBundle,
  type CompositeSprite,
  type OnionSkinController,
  type OnionSkinSettings,
  type SpriteAnimClip,
  type SpriteAnimPlayer,
  type SpritePartPose,
  type SpriteRigDef
} from '@/core/sprite';

interface UseCompositePreviewParams {
  sceneRef: MutableRefObject<Scene | null>;
  cameraRef: MutableRefObject<ArcRotateCamera | null>;
  sceneEpoch: number;
  rig: SpriteRigDef | null;
  clip: SpriteAnimClip | null;
  scrubTime: number;
  selectedPartId: string;
  onionSkin: OnionSkinSettings;
  setMessage: (message: string) => void;
  onPartPicked?: (partId: string) => void;
  onPartDragged?: (partId: string, pose: Pick<SpritePartPose, 'x' | 'y'>) => void;
}

interface UseCompositePreviewResult {
  playing: boolean;
  currentTime: number;
  duration: number;
  compositeRef: MutableRefObject<CompositeSprite | null>;
  rebuildPreview: () => Promise<void>;
  play: () => void;
  pause: () => void;
  stop: () => void;
  seek: (time: number) => void;
}

const buildRigSignature = (nextRig: SpriteRigDef): string =>
  JSON.stringify({
    rigId: nextRig.rigId,
    atlasJsonPath: nextRig.atlasJsonPath,
    atlasImagePath: nextRig.atlasImagePath,
    baseSize: nextRig.baseSize,
    parts: nextRig.parts.map((part) => ({
      partId: part.partId,
      atlasJsonPath: part.atlasJsonPath,
      atlasImagePath: part.atlasImagePath,
      defaultFrameName: part.defaultFrameName,
      transform: part.transform,
      zIndex: part.zIndex
    }))
  });

export const useCompositePreview = ({
  sceneRef,
  cameraRef,
  sceneEpoch,
  rig,
  clip,
  scrubTime,
  selectedPartId,
  onionSkin,
  setMessage,
  onPartPicked,
  onPartDragged
}: UseCompositePreviewParams): UseCompositePreviewResult => {
  const compositeRef = useRef<CompositeSprite | null>(null);
  const playerRef = useRef<SpriteAnimPlayer | null>(null);
  const onionRef = useRef<OnionSkinController | null>(null);
  const atlasesRef = useRef<AtlasBundle | null>(null);
  const clipRef = useRef<SpriteAnimClip | null>(clip);
  const onionSkinRef = useRef(onionSkin);
  const rigSignatureRef = useRef('');
  const scrubTimeRef = useRef(scrubTime);
  const onPartPickedRef = useRef(onPartPicked);
  const onPartDraggedRef = useRef(onPartDragged);
  const draggingRef = useRef(false);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  scrubTimeRef.current = scrubTime;
  onPartPickedRef.current = onPartPicked;
  onPartDraggedRef.current = onPartDragged;
  clipRef.current = clip;
  onionSkinRef.current = onionSkin;

  const syncOnionSkin = useCallback((time: number) => {
    const activeClip = clipRef.current;
    const onion = onionRef.current;
    if (!onion || !activeClip) return;
    onion.update(activeClip, time, onionSkinRef.current);
  }, []);

  const disposeRuntime = useCallback(() => {
    playerRef.current?.dispose();
    playerRef.current = null;
    onionRef.current?.dispose();
    onionRef.current = null;
    compositeRef.current?.dispose();
    compositeRef.current = null;
    atlasesRef.current = null;
    rigSignatureRef.current = '';
  }, []);

  const syncClipToPlayer = useCallback(
    (nextClip: SpriteAnimClip | null, nextRig: SpriteRigDef | null) => {
      const composite = compositeRef.current;
      if (!composite || !nextRig) return;

      if (nextClip && nextClip.rigId === nextRig.rigId) {
        if (!playerRef.current) {
          playerRef.current = createSpriteAnimPlayer(composite, nextClip);
        } else {
          playerRef.current.setClip(nextClip, false);
        }
        if (!draggingRef.current && playerRef.current.getState() !== 'playing') {
          playerRef.current.seek(scrubTimeRef.current);
          setCurrentTime(playerRef.current.getTime());
          syncOnionSkin(playerRef.current.getTime());
        }
        setDuration(getClipDuration(nextClip));
      } else {
        playerRef.current?.dispose();
        playerRef.current = null;
        composite.resetToBindPose();
        setDuration(0);
        setCurrentTime(0);
        setPlaying(false);
        onionRef.current?.update(
          { clipId: '', rigId: '', fps: 12, loop: false, keys: [] },
          0,
          { ...onionSkinRef.current, enabled: false }
        );
      }
    },
    [syncOnionSkin]
  );

  const mountRuntime = useCallback(
    async (scene: Scene, nextRig: SpriteRigDef, nextClip: SpriteAnimClip | null, keepTime: number) => {
      const signature = buildRigSignature(nextRig);
      const atlases = await loadRigAtlases(nextRig);
      disposeRuntime();

      const composite = createCompositeSprite(scene, nextRig, atlases);
      compositeRef.current = composite;
      atlasesRef.current = atlases;
      rigSignatureRef.current = signature;

      const onion = createOnionSkinController(scene);
      onion.rebuild(nextRig, atlases);
      onionRef.current = onion;

      syncClipToPlayer(nextClip, nextRig);
      playerRef.current?.seek(keepTime);
      const time = playerRef.current?.getTime() ?? keepTime;
      setCurrentTime(time);
      syncOnionSkin(time);
    },
    [disposeRuntime, syncClipToPlayer, syncOnionSkin]
  );

  const rebuildPreview = useCallback(async () => {
    const scene = sceneRef.current;
    if (!scene || !rig) {
      disposeRuntime();
      setPlaying(false);
      setCurrentTime(0);
      setDuration(0);
      return;
    }

    try {
      const keepTime = playerRef.current?.getTime() ?? scrubTimeRef.current;
      await mountRuntime(scene, rig, clip, keepTime);
      setPlaying(false);
      setMessage(`预览已重建：${rig.rigId}`);
    } catch (error) {
      disposeRuntime();
      setMessage(`预览重建失败：${String(error)}`);
    }
  }, [sceneRef, rig, clip, disposeRuntime, mountRuntime, setMessage]);

  // Rig 结构变化时重建网格/纹理
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene || !rig) {
      disposeRuntime();
      return;
    }

    const signature = buildRigSignature(rig);
    if (signature === rigSignatureRef.current && compositeRef.current) {
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const keepTime = playerRef.current?.getTime() ?? scrubTimeRef.current;
        await mountRuntime(scene, rig, clip, keepTime);
        if (cancelled) return;
      } catch (error) {
        if (!cancelled) {
          disposeRuntime();
          setMessage(`预览重建失败：${String(error)}`);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sceneRef, sceneEpoch, rig, disposeRuntime, setMessage, mountRuntime]);

  useEffect(() => {
    if (!compositeRef.current || !rig) return;
    syncClipToPlayer(clip, rig);
  }, [clip, rig, syncClipToPlayer]);

  useEffect(() => () => disposeRuntime(), [disposeRuntime]);

  useEffect(() => {
    const player = playerRef.current;
    if (!player || draggingRef.current) return;
    if (player.getState() === 'playing') return;
    player.seek(scrubTime);
    setCurrentTime(player.getTime());
    syncOnionSkin(player.getTime());
  }, [scrubTime, syncOnionSkin]);

  // 洋葱皮设置变化时立即刷新
  useEffect(() => {
    const time = playerRef.current?.getTime() ?? scrubTimeRef.current;
    syncOnionSkin(time);
  }, [onionSkin, syncOnionSkin]);

  useEffect(() => {
    compositeRef.current?.setHighlightedPart(selectedPartId || null);
  }, [selectedPartId]);

  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;

    const observer = scene.onBeforeRenderObservable.add(() => {
      const player = playerRef.current;
      if (!player) return;
      const dt = scene.getEngine().getDeltaTime() / 1000;
      player.update(dt);
      const time = player.getTime();
      setCurrentTime(time);
      setPlaying(player.getState() === 'playing');
      setDuration(player.getDuration());
      syncOnionSkin(time);
    });

    return () => {
      scene.onBeforeRenderObservable.remove(observer);
    };
  }, [sceneRef, sceneEpoch, rig?.rigId, syncOnionSkin]);

  useEffect(() => {
    const scene = sceneRef.current;
    const canvas = scene?.getEngine().getRenderingCanvas();
    if (!scene || !canvas) return;

    type DragState = {
      partId: string;
      pointerId: number;
      grabOffset: { x: number; y: number };
    };
    let drag: DragState | null = null;

    const toWorld = (clientX: number, clientY: number): { x: number; y: number } | null => {
      const camera = cameraRef.current ?? (scene.activeCamera as ArcRotateCamera | null);
      if (!camera) return null;
      const rect = canvas.getBoundingClientRect();
      const px = ((clientX - rect.left) / Math.max(1, rect.width)) * canvas.width;
      const py = ((clientY - rect.top) / Math.max(1, rect.height)) * canvas.height;
      const ray = scene.createPickingRay(px, py, null, camera);
      if (Math.abs(ray.direction.z) < 1e-6) {
        return { x: ray.origin.x, y: ray.origin.y };
      }
      const t = -ray.origin.z / ray.direction.z;
      const hit = ray.origin.add(ray.direction.scale(t));
      return { x: hit.x, y: hit.y };
    };

    const onPointerDown = (event: PointerEvent) => {
      if (event.button !== 0) return;
      const camera = cameraRef.current ?? (scene.activeCamera as ArcRotateCamera | null);
      if (!camera) return;
      const rect = canvas.getBoundingClientRect();
      const px = ((event.clientX - rect.left) / Math.max(1, rect.width)) * canvas.width;
      const py = ((event.clientY - rect.top) / Math.max(1, rect.height)) * canvas.height;
      const pick = scene.pick(px, py, (mesh) => mesh.isPickable && mesh.isEnabled(), false, camera);
      if (!pick?.hit || !pick.pickedMesh) return;

      const part = compositeRef.current?.getPartByMeshUniqueId(pick.pickedMesh.uniqueId);
      if (!part) return;

      event.preventDefault();
      const world = toWorld(event.clientX, event.clientY);
      const pose = part.getPose();
      drag = {
        partId: part.partId,
        pointerId: event.pointerId,
        grabOffset: {
          x: pose.x - (world?.x ?? pose.x),
          y: pose.y - (world?.y ?? pose.y)
        }
      };
      draggingRef.current = true;
      canvas.setPointerCapture(event.pointerId);
      onPartPickedRef.current?.(part.partId);
      playerRef.current?.pause();
      setPlaying(false);
    };

    const onPointerMove = (event: PointerEvent) => {
      if (!drag || drag.pointerId !== event.pointerId) return;
      const world = toWorld(event.clientX, event.clientY);
      if (!world) return;
      const next = {
        x: toFixedNumber(world.x + drag.grabOffset.x),
        y: toFixedNumber(world.y + drag.grabOffset.y)
      };
      compositeRef.current?.getPart(drag.partId)?.applyPose(next);
      onPartDraggedRef.current?.(drag.partId, next);
    };

    const onPointerUp = (event: PointerEvent) => {
      if (!drag || drag.pointerId !== event.pointerId) return;
      try {
        canvas.releasePointerCapture(event.pointerId);
      } catch {
        // ignore
      }
      drag = null;
      draggingRef.current = false;
      playerRef.current?.seek(scrubTimeRef.current);
      const time = playerRef.current?.getTime() ?? scrubTimeRef.current;
      setCurrentTime(time);
      syncOnionSkin(time);
    };

    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerup', onPointerUp);
    canvas.addEventListener('pointercancel', onPointerUp);

    return () => {
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerup', onPointerUp);
      canvas.removeEventListener('pointercancel', onPointerUp);
    };
  }, [sceneRef, cameraRef, sceneEpoch, rig?.rigId, syncOnionSkin]);

  const play = useCallback(() => {
    playerRef.current?.play();
    setPlaying(true);
  }, []);

  const pause = useCallback(() => {
    playerRef.current?.pause();
    setPlaying(false);
  }, []);

  const stop = useCallback(() => {
    playerRef.current?.stop();
    setPlaying(false);
    setCurrentTime(0);
    syncOnionSkin(0);
  }, [syncOnionSkin]);

  const seek = useCallback(
    (time: number) => {
      const player = playerRef.current;
      if (!player) return;
      if (player.getState() === 'playing') {
        player.pause();
        setPlaying(false);
      }
      player.seek(time);
      setCurrentTime(player.getTime());
      syncOnionSkin(player.getTime());
    },
    [syncOnionSkin]
  );

  return {
    playing,
    currentTime,
    duration,
    compositeRef,
    rebuildPreview,
    play,
    pause,
    stop,
    seek
  };
};
