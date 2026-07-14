import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArcRotateCamera, Color4, Engine, HemisphericLight, Scene, Vector3 } from '@babylonjs/core';
import type { Mesh } from '@babylonjs/core';
import {
  createSpriteEntity,
  drawSpriteDebugOverlay,
  getAllSpriteAnchorPresets,
  getSpriteAnchorPreset,
  hydrateSpriteAnchorPresetStorage,
  parseSpritePresetKey,
  type SpriteAnchorPreset,
  type SpriteEntity
} from '@/core/sprite';
import {
  getRuntimeKind,
  invokeNative,
  isElectronRuntime,
  listenNative,
  type PetMood,
  type PetStatePayload
} from '@/runtime/nativeBridge';

const toFrameRegion = (preset: SpriteAnchorPreset) => {
  if (!preset.atlasFrame) return null;
  return {
    frameName: preset.atlasFrame.frameName,
    frame: preset.atlasFrame.frame,
    spriteSourceSize: preset.atlasFrame.spriteSourceSize,
    sourceSize: preset.atlasFrame.sourceSize,
    atlasSize: preset.atlasFrame.atlasSize,
    rotated: preset.atlasFrame.rotated,
    trimmed: preset.atlasFrame.trimmed
  };
};

export const DesktopPetApp = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const sceneRef = useRef<Scene | null>(null);
  const spriteRef = useRef<SpriteEntity | null>(null);
  const debugMeshesRef = useRef<Mesh[]>([]);
  const speedRef = useRef(1);
  const [mood, setMood] = useState<PetMood>('idle');
  const [heartbeatLabel, setHeartbeatLabel] = useState('-');
  const [presetKeys, setPresetKeys] = useState<string[]>([]);
  const [activePresetKey, setActivePresetKey] = useState('');
  const [isDebugVisible, setIsDebugVisible] = useState(false);
  const runtimeLabel = useMemo(() => getRuntimeKind(), []);

  const controlVisible = useMemo(() => {
    return !isElectronRuntime() || new URLSearchParams(window.location.search).get('debug') === '1';
  }, []);

  const applyMood = useCallback((nextMood: PetMood, speed: number) => {
    setMood(nextMood);
    speedRef.current = Math.max(0.1, speed);
  }, []);

  const disposeDebugMeshes = useCallback(() => {
    debugMeshesRef.current.forEach((mesh) => mesh.dispose());
    debugMeshesRef.current = [];
  }, []);

  const redrawDebug = useCallback((preset: SpriteAnchorPreset) => {
    const scene = sceneRef.current;
    const sprite = spriteRef.current;
    if (!scene || !sprite) return;
    disposeDebugMeshes();
    if (!isDebugVisible) return;
    debugMeshesRef.current = drawSpriteDebugOverlay({ ...sprite, preset }, scene);
  }, [disposeDebugMeshes, isDebugVisible]);

  const applySpritePreset = useCallback((presetKey: string) => {
    const scene = sceneRef.current;
    if (!scene || !presetKey) return;
    const preset = getSpriteAnchorPreset(presetKey, 'config');
    const parsed = parseSpritePresetKey(presetKey);
    const texturePath = encodeURI(`/${parsed.imagePath || preset.imagePath}`);
    const nextFrameRegion = toFrameRegion(preset);

    disposeDebugMeshes();
    spriteRef.current?.mesh.dispose(false, true);
    spriteRef.current = createSpriteEntity(scene, texturePath, 1.9, 'config', nextFrameRegion);
    redrawDebug(preset);
  }, [disposeDebugMeshes, redrawDebug]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      await hydrateSpriteAnchorPresetStorage();
      if (cancelled) return;
      const keys = Object.keys(getAllSpriteAnchorPresets()).sort((a, b) => a.localeCompare(b, 'zh-CN'));
      setPresetKeys(keys);
      if (keys.length > 0) {
        setActivePresetKey((prev) => (prev && keys.includes(prev)) ? prev : keys[0]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const engine = new Engine(canvas, true, { preserveDrawingBuffer: true, stencil: true });
    const scene = new Scene(engine);
    scene.clearColor = new Color4(0, 0, 0, 0);
    sceneRef.current = scene;

    const camera = new ArcRotateCamera('desktop_pet_camera', -Math.PI / 2, Math.PI / 2, 3, Vector3.Zero(), scene);
    camera.lowerAlphaLimit = -Math.PI / 2;
    camera.upperAlphaLimit = -Math.PI / 2;
    camera.lowerBetaLimit = Math.PI / 2;
    camera.upperBetaLimit = Math.PI / 2;
    camera.mode = ArcRotateCamera.ORTHOGRAPHIC_CAMERA;
    camera.target = new Vector3(0, 0, 0);

    const light = new HemisphericLight('desktop_pet_light', new Vector3(0, 1, 0), scene);
    light.intensity = 0.8;

    const updateOrtho = () => {
      const width = Math.max(canvas.clientWidth, 1);
      const height = Math.max(canvas.clientHeight, 1);
      const aspect = width / height;
      const halfHeight = 1.2;
      camera.orthoTop = halfHeight;
      camera.orthoBottom = -halfHeight;
      camera.orthoLeft = -halfHeight * aspect;
      camera.orthoRight = halfHeight * aspect;
    };

    const startTime = performance.now();
    engine.runRenderLoop(() => {
      const sprite = spriteRef.current;
      if (sprite) {
        const elapsed = (performance.now() - startTime) / 1000;
        const speed = speedRef.current;
        sprite.mesh.position.y = Math.sin(elapsed * 2.2 * speed) * 0.06;
        sprite.mesh.rotation.z = Math.sin(elapsed * 1.1 * speed) * 0.06;
      }
      scene.render();
    });

    const onResize = () => {
      engine.resize();
      updateOrtho();
    };
    window.addEventListener('resize', onResize);
    onResize();

    return () => {
      window.removeEventListener('resize', onResize);
      disposeDebugMeshes();
      spriteRef.current?.mesh.dispose(false, true);
      spriteRef.current = null;
      sceneRef.current = null;
      light.dispose();
      camera.dispose();
      scene.dispose();
      engine.dispose();
    };
  }, [disposeDebugMeshes]);

  useEffect(() => {
    applySpritePreset(activePresetKey);
  }, [activePresetKey, applySpritePreset]);

  useEffect(() => {
    if (!activePresetKey) return;
    const preset = getSpriteAnchorPreset(activePresetKey, 'config');
    redrawDebug(preset);
  }, [activePresetKey, redrawDebug, isDebugVisible]);

  useEffect(() => {
    if (!isElectronRuntime()) {
      return;
    }

    let unlistenState: null | (() => void) = null;
    let unlistenHeartbeat: null | (() => void) = null;

    const init = async () => {
      try {
        const current = await invokeNative<PetStatePayload, 'pet:get-state'>('pet:get-state');
        applyMood(current.mood, current.animation_speed);
      } catch {
        // Ignore bootstrap failures in skeleton mode.
      }

      try {
        unlistenState = await listenNative('pet://state_changed', (payload) => {
          applyMood(payload.mood, payload.animation_speed);
        });
        unlistenHeartbeat = await listenNative('pet://heartbeat', (payload) => {
          setHeartbeatLabel(new Date(payload.unix_ms).toLocaleTimeString());
        });
      } catch {
        // Ignore event bridge failures in skeleton mode.
      }
    };

    void init();

    return () => {
      unlistenState?.();
      unlistenHeartbeat?.();
    };
  }, [applyMood]);

  const sendMood = useCallback(async (nextMood: PetMood, speed: number) => {
    applyMood(nextMood, speed);
    if (!isElectronRuntime()) return;
    try {
      await invokeNative('pet:set-state', { mood: nextMood, animation_speed: speed });
    } catch {
      // Keep local fallback if backend unavailable.
    }
  }, [applyMood]);

  const switchToGameMode = useCallback(async () => {
    if (!isElectronRuntime()) return;
    try {
      await invokeNative('window:switch-to-game-mode');
    } catch {
      // Ignore switching errors in web debug mode.
    }
  }, []);

  return (
    <div className={`desktop-pet-root${controlVisible ? ' desktop-pet-root--debug' : ''}`}>
      <canvas ref={canvasRef} className="desktop-pet-canvas" />
      {controlVisible ? (
        <div className="desktop-pet-panel">
          <div>Runtime: {runtimeLabel}</div>
          <div>Mood: {mood}</div>
          <div>Heartbeat: {heartbeatLabel}</div>
          <div>Sprite Preset:</div>
          <select
            value={activePresetKey}
            onChange={(event) => setActivePresetKey(event.target.value)}
            style={{ width: '100%', marginTop: 4 }}
          >
            {presetKeys.map((key) => (
              <option key={key} value={key}>{key}</option>
            ))}
          </select>
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 6 }}>
            <input
              type="checkbox"
              checked={isDebugVisible}
              onChange={(event) => setIsDebugVisible(event.target.checked)}
            />
            Debug 锚点/包围盒
          </label>
          <div className="desktop-pet-buttons">
            <button onClick={() => { void sendMood('idle', 1); }}>Idle</button>
            <button onClick={() => { void sendMood('happy', 1.35); }}>Happy</button>
            <button onClick={() => { void sendMood('sleep', 0.55); }}>Sleep</button>
            <button onClick={() => { void switchToGameMode(); }}>切回 MainGame</button>
          </div>
        </div>
      ) : null}
    </div>
  );
};
