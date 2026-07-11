import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';

type PetMood = 'idle' | 'happy' | 'sleep';

type PetStatePayload = {
  mood: PetMood;
  animation_speed: number;
};

type HeartbeatPayload = {
  unix_ms: number;
};

const isTauriRuntime = (): boolean => typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

const createPetTexture = (): THREE.CanvasTexture => {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Failed to create canvas context for pet texture');
  }

  ctx.clearRect(0, 0, 256, 256);
  ctx.fillStyle = '#ffcc7a';
  ctx.beginPath();
  ctx.arc(128, 128, 92, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#222';
  ctx.beginPath();
  ctx.arc(95, 110, 11, 0, Math.PI * 2);
  ctx.arc(161, 110, 11, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = '#222';
  ctx.lineWidth = 8;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(100, 162);
  ctx.quadraticCurveTo(128, 182, 156, 162);
  ctx.stroke();

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
};

const moodToTint = (mood: PetMood): THREE.ColorRepresentation => {
  if (mood === 'happy') return '#9cffc4';
  if (mood === 'sleep') return '#92b7ff';
  return '#ffffff';
};

export const DesktopPetApp = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const meshRef = useRef<THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial> | null>(null);
  const frameRef = useRef<number | null>(null);
  const speedRef = useRef(1);
  const [mood, setMood] = useState<PetMood>('idle');
  const [heartbeatLabel, setHeartbeatLabel] = useState('-');
  const runtimeLabel = useMemo<'tauri' | 'web'>(() => (isTauriRuntime() ? 'tauri' : 'web'), []);

  const controlVisible = useMemo(() => {
    return !isTauriRuntime() || new URLSearchParams(window.location.search).get('debug') === '1';
  }, []);

  const applyMood = useCallback((nextMood: PetMood, speed: number) => {
    setMood(nextMood);
    speedRef.current = Math.max(0.1, speed);
    const mesh = meshRef.current;
    if (!mesh) return;
    mesh.material.color.set(moodToTint(nextMood));
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: true,
      premultipliedAlpha: true
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);
    renderer.setClearColor(0x000000, 0);

    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
    camera.position.z = 2;

    const geometry = new THREE.PlaneGeometry(1.4, 1.4);
    const fallbackTexture = createPetTexture();
    const material = new THREE.MeshBasicMaterial({
      map: fallbackTexture,
      transparent: true,
      color: moodToTint('idle')
    });
    const textureLoader = new THREE.TextureLoader();
    textureLoader.load(
      '/resources/优势.png',
      (loadedTexture) => {
        loadedTexture.colorSpace = THREE.SRGBColorSpace;
        loadedTexture.needsUpdate = true;
        const previousMap = material.map;
        material.map = loadedTexture;
        material.needsUpdate = true;
        if (previousMap !== loadedTexture) previousMap?.dispose();
      },
      undefined,
      () => {
        // Keep fallback texture when target image not found.
      }
    );
    const petMesh = new THREE.Mesh(geometry, material);
    meshRef.current = petMesh;
    scene.add(petMesh);

    const clock = new THREE.Clock();
    const animate = () => {
      const elapsed = clock.getElapsedTime();
      const speed = speedRef.current;
      petMesh.position.y = Math.sin(elapsed * 2.2 * speed) * 0.06;
      petMesh.rotation.z = Math.sin(elapsed * 1.1 * speed) * 0.06;
      renderer.render(scene, camera);
      frameRef.current = window.requestAnimationFrame(animate);
    };
    animate();

    const onResize = () => {
      const width = Math.max(canvas.clientWidth, 1);
      const height = Math.max(canvas.clientHeight, 1);
      renderer.setSize(width, height, false);
      const aspect = width / height;
      camera.left = -aspect;
      camera.right = aspect;
      camera.top = 1;
      camera.bottom = -1;
      camera.updateProjectionMatrix();
    };
    window.addEventListener('resize', onResize);
    onResize();

    return () => {
      window.removeEventListener('resize', onResize);
      if (frameRef.current !== null) window.cancelAnimationFrame(frameRef.current);
      meshRef.current = null;
      geometry.dispose();
      material.map?.dispose();
      material.dispose();
      renderer.dispose();
    };
  }, []);

  useEffect(() => {
    if (!isTauriRuntime()) {
      return;
    }

    let unlistenState: null | (() => void) = null;
    let unlistenHeartbeat: null | (() => void) = null;

    const init = async () => {
      try {
        const current = await invoke<PetStatePayload>('pet_get_state');
        applyMood(current.mood, current.animation_speed);
      } catch {
        // Ignore bootstrap failures in skeleton mode.
      }

      try {
        unlistenState = await listen<PetStatePayload>('pet://state_changed', (event) => {
          applyMood(event.payload.mood, event.payload.animation_speed);
        });
        unlistenHeartbeat = await listen<HeartbeatPayload>('pet://heartbeat', (event) => {
          setHeartbeatLabel(new Date(event.payload.unix_ms).toLocaleTimeString());
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
    if (!isTauriRuntime()) return;
    try {
      await invoke('pet_set_state', { payload: { mood: nextMood, animation_speed: speed } });
    } catch {
      // Keep local fallback if backend unavailable.
    }
  }, [applyMood]);

  const switchToGameMode = useCallback(async () => {
    if (!isTauriRuntime()) return;
    try {
      await invoke('switch_to_game_mode');
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
          <div className="desktop-pet-buttons">
            <button onClick={() => { void sendMood('idle', 1); }}>Idle</button>
            <button onClick={() => { void sendMood('happy', 1.35); }}>Happy</button>
            <button onClick={() => { void sendMood('sleep', 0.55); }}>Sleep</button>
            <button onClick={() => { void switchToGameMode(); }}>切回主界面</button>
          </div>
        </div>
      ) : null}
    </div>
  );
};
