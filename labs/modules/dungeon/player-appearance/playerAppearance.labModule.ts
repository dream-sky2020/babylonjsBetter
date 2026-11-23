import { TransformNode } from '@babylonjs/core';
import { getDungeonMovementDirectionVector } from '@/core/dungeon-movement/dungeonMovement.direction';
import { mapDungeonDisplayPosition } from '@/core/dungeon-view/dungeonOverheadView';
import { resolveAppAssetUrl } from '@/core/resources/appAssetUrl';
import { createAtlasSpritePlane } from '@/core/sprite/render/createAtlasSpritePlane';
import type { SpriteFrameRegion } from '@/core/sprite/types/sprite.types';
import type { LabModule } from '@/labs/kit';
import { createLabStatus } from '@/labs/kit/labUi';
import { DUNGEON_OVERHEAD_VIEW_SERVICE_KEY, type DungeonOverheadViewService } from '../dungeon-overhead-view/dungeonOverheadView.references';
import { DUNGEON_PLAYER_CAMERA_SERVICE_KEY, type DungeonPlayerCameraService } from '../dungeon-player-camera/dungeonPlayerCamera.references';
import { DUNGEON_PLAYER_STATE_MEMORY } from '../dungeon-runtime/dungeonRuntime.memory';
import { DUNGEON_PLAYER_SPAWN_MEMORY } from '../player-spawn/playerSpawn.memory';

const frameSize = { w: 30, h: 40 };
const frame = (frameName: string, x: number, y: number): SpriteFrameRegion => ({
  frameName,
  frame: { x, y, ...frameSize },
  spriteSourceSize: { x: 0, y: 0, ...frameSize },
  sourceSize: frameSize,
  atlasSize: { w: 62, h: 82 },
  rotated: false,
  trimmed: false,
});

const frames = {
  back: frame('back', 0, 0),
  right: frame('right', 32, 0),
  front: frame('front', 0, 42),
  left: frame('left', 32, 42),
};

const moduleId = 'player-appearance';
const atlasPath = 'resources/神彩怒放主角.png';
const defaultSampling = 'trilinear';
const prescaleFactors = {
  'prescaled-2x': 2,
  'prescaled-4x': 4,
  'prescaled-8x': 8,
  'prescaled-16x': 16,
} as const;
type TextureSampling = typeof defaultSampling | keyof typeof prescaleFactors;
const maxOffsetPercent = 50;
const centeredOffsets = { 'foot-offset-x': 0, 'foot-offset-z': 0 };
type PlayerAppearanceConfig = typeof centeredOffsets & {
  'world-height': number | null;
  'texture-sampling': TextureSampling;
};
const isTextureSampling = (value: unknown): value is TextureSampling =>
  value === defaultSampling || (typeof value === 'string' && Object.hasOwn(prescaleFactors, value));
const offsetField = {
  defaultValue: 0,
  valid: (value: unknown) => typeof value === 'number' && Number.isFinite(value) && Math.abs(value) <= maxOffsetPercent,
};
const offsetAxes = [
  { key: 'foot-offset-x', label: '东西偏移（东为正）' },
  { key: 'foot-offset-z', label: '南北偏移（南为正）' },
] as const;

export const playerAppearanceLabModule: LabModule = {
  id: moduleId,
  dependencies: ['dungeon-map-loader', 'dungeon-overhead-view', 'dungeon-player-camera'],
  setup(context) {
    const config = context.config;
    const appearance: PlayerAppearanceConfig = config ? config.register(moduleId, {
      'foot-offset-x': offsetField,
      'foot-offset-z': offsetField,
      'texture-sampling': {
        defaultValue: defaultSampling,
        valid: isTextureSampling,
      },
      'world-height': {
        defaultValue: null,
        valid: value => value === null || (typeof value === 'number' && Number.isFinite(value) && value > 0),
      },
    }) as PlayerAppearanceConfig : { ...centeredOffsets, 'world-height': null, 'texture-sampling': defaultSampling };

    const panel = context.ui.addPanel(moduleId, '玩家外观');
    const samplingRow = document.createElement('label');
    samplingRow.className = 'lab-field';
    samplingRow.textContent = '贴图采样';
    const sampling = document.createElement('select');
    sampling.dataset.labSetting = 'texture-sampling';
    sampling.append(
      new Option('默认三线性', defaultSampling),
      ...Object.entries(prescaleFactors).map(([value, factor]) => new Option(`最近邻预放大 ${factor}× + 三线性`, value)),
    );
    sampling.value = appearance['texture-sampling'];
    samplingRow.append(sampling);
    const samplingStatus = createLabStatus('');
    samplingStatus.setAttribute('role', 'status');
    samplingStatus.hidden = true;
    panel.content.append(samplingRow, samplingStatus);
    const readout = createLabStatus('');
    const reset = document.createElement('button');
    reset.type = 'button';
    reset.textContent = '恢复脚底居中';

    const controls = offsetAxes.map(({ key, label }) => {
      const row = document.createElement('div');
      row.className = 'lab-field';
      const caption = document.createElement('span');
      caption.textContent = label;
      const inputs = document.createElement('div');
      inputs.className = 'player-appearance-offset-inputs';

      const slider = document.createElement('input');
      slider.type = 'range';
      slider.dataset.labSetting = key;
      slider.setAttribute('aria-label', `${label}滑块`);
      const number = document.createElement('input');
      number.type = 'number';
      number.inputMode = 'decimal';
      number.dataset.footOffsetInput = key;
      number.setAttribute('aria-label', `${label}百分比`);
      for (const control of [slider, number]) {
        control.min = String(-maxOffsetPercent);
        control.max = String(maxOffsetPercent);
        control.step = 'any';
      }

      // 拖动仍以整数百分比调整，滑块也能显示输入框设置的小数值。
      slider.addEventListener('input', () => setOffsets({ [key]: Math.round(slider.valueAsNumber) }));
      number.addEventListener('input', () => {
        const value = number.valueAsNumber;
        if (offsetField.valid(value)) setOffsets({ [key]: value }, number);
      });
      const commit = () => {
        const value = number.valueAsNumber;
        if (Number.isFinite(value)) {
          setOffsets({ [key]: Math.max(-maxOffsetPercent, Math.min(maxOffsetPercent, value)) });
        } else {
          number.value = String(appearance[key]);
        }
      };
      number.addEventListener('blur', commit);
      number.addEventListener('keydown', event => {
        if (event.key === 'Enter') commit();
      });

      inputs.append(slider, number);
      row.append(caption, inputs);
      panel.content.append(row);
      return { key, slider, number };
    });

    function syncControls(activeInput?: HTMLInputElement) {
      for (const { key, slider, number } of controls) {
        const value = String(appearance[key]);
        slider.value = value;
        slider.setAttribute('aria-valuetext', `${value}%`);
        if (number !== activeInput) number.value = value;
      }
      readout.textContent = `格面宽度的 ${appearance['foot-offset-x']}%，深度的 ${appearance['foot-offset-z']}%`;
    }

    function setOffsets(patch: Partial<typeof centeredOffsets>, activeInput?: HTMLInputElement) {
      if (config) config.update(moduleId, patch);
      else Object.assign(appearance, patch);
      syncControls(activeInput);
    }

    reset.addEventListener('click', () => setOffsets(centeredOffsets));
    panel.content.append(readout, reset);
    syncControls();

    const playerMemory = context.memory.acquire(DUNGEON_PLAYER_STATE_MEMORY);
    const spawnMemory = context.memory.acquire(DUNGEON_PLAYER_SPAWN_MEMORY);
    const overhead = context.services.get<DungeonOverheadViewService>(DUNGEON_OVERHEAD_VIEW_SERVICE_KEY);
    const playerCamera = context.services.get<DungeonPlayerCameraService>(DUNGEON_PLAYER_CAMERA_SERVICE_KEY);

    const root = new TransformNode('dungeon-player-appearance', context.scene);
    root.billboardMode = TransformNode.BILLBOARDMODE_ALL;
    root.setEnabled(false);

    function createSprite(path: string, name: string) {
      const sprite = createAtlasSpritePlane(context.scene, path, 1, { deformation: false });
      sprite.mesh.name = name;
      sprite.mesh.parent = root;
      sprite.mesh.isPickable = false;
      sprite.setFrameRegion(frames.front);
      return sprite;
    }
    const defaultSprite = createSprite(atlasPath, 'dungeon-player-sprite');
    let prescaledSprite: ReturnType<typeof createSprite> | undefined;
    let sourceImage: HTMLImageElement | undefined;
    let displayedSprite = defaultSprite;
    let displayedHeight: number | undefined;

    function showSprite(sprite: ReturnType<typeof createSprite>) {
      if (sprite === displayedSprite) return;
      displayedSprite.mesh.setEnabled(false);
      sprite.mesh.setEnabled(true);
      displayedSprite = sprite;
      displayedHeight = undefined;
    }

    function releasePrescale() {
      if (sourceImage) {
        sourceImage.onload = null;
        sourceImage.onerror = null;
        sourceImage = undefined;
      }
      prescaledSprite?.dispose?.();
      prescaledSprite = undefined;
    }

    function loadPrescaledSprite(factor: number) {
      const image = new Image();
      sourceImage = image;
      const showError = () => {
        sourceImage = undefined;
        samplingStatus.textContent = '预放大贴图加载失败，当前使用默认三线性。';
        samplingStatus.hidden = false;
      };
      image.onerror = showError;
      image.onload = () => {
        sourceImage = undefined;
        try {
          const canvas = document.createElement('canvas');
          canvas.width = image.naturalWidth * factor;
          canvas.height = image.naturalHeight * factor;
          const drawing = canvas.getContext('2d');
          if (!drawing) {
            showError();
            return;
          }
          drawing.imageSmoothingEnabled = false;
          drawing.drawImage(image, 0, 0, canvas.width, canvas.height);
          // 整张图集等比放大，方向帧的 UV 比例与面片尺寸沿用原值。
          prescaledSprite = createSprite(canvas.toDataURL('image/png'), 'dungeon-player-sprite-prescaled');
          prescaledSprite.mesh.setEnabled(false);
        } catch {
          showError();
        }
      };
      image.src = resolveAppAssetUrl(atlasPath);
    }

    sampling.addEventListener('change', () => {
      const value = sampling.value;
      if (!isTextureSampling(value)) return;
      if (config) config.update(moduleId, { 'texture-sampling': value });
      else appearance['texture-sampling'] = value;
      samplingStatus.hidden = true;
      showSprite(defaultSprite);
      releasePrescale();
      if (value !== defaultSampling) loadPrescaledSprite(prescaleFactors[value]);
    });
    const initialSampling = appearance['texture-sampling'];
    if (initialSampling !== defaultSampling) loadPrescaledSprite(prescaleFactors[initialSampling]);

    const stop = context.scheduler.register({
      id: 'sync-sprite', phase: 'presentation', order: 110, description: '同步玩家精灵的位置与朝向',
      run() {
        const sprite = prescaledSprite?.texture.isReady() ? prescaledSprite : defaultSprite;
        showSprite(sprite);
        const player = playerMemory.current;
        const spawn = spawnMemory.current;
        const camera = context.scene.activeCamera;
        if (!player || !spawn || player.loadId !== spawn.loadId || !camera || !sprite.texture.isReady()
            || (playerCamera.bindingEnabled && playerCamera.mode === 'first-person')) {
          root.setEnabled(false);
          return;
        }

        const [tileWidth, tileHeight, tileDepth] = spawn.tileSize;
        const height = appearance['world-height'] ?? Math.min(tileWidth, tileDepth) * 0.75;
        if (height !== displayedHeight) {
          displayedHeight = height;
          sprite.setDisplayScale(height);
          sprite.mesh.position.y = height / 2;
        }

        const [playerX, playerY, playerZ] = player.playerWorldPosition;
        const [x, y, z] = mapDungeonDisplayPosition(overhead.displayedView, [
          playerX + tileWidth * appearance['foot-offset-x'] / 100,
          playerY,
          playerZ + tileDepth * appearance['foot-offset-z'] / 100,
        ]);
        root.position.set(x, y + tileHeight / 2, z);

        // 图集方向以画面为准。把地图朝向投到相机的水平和垂直轴，再选最接近的一帧。
        const facing = getDungeonMovementDirectionVector(player.playerFacing);
        const view = camera.getViewMatrix().m;
        const right = facing.x * view[0] + facing.y * view[8];
        const up = (facing.x * view[1] + facing.y * view[9]) / (Math.hypot(view[1], view[9]) || 1);
        const region = Math.abs(right) > Math.abs(up)
          ? (right > 0 ? frames.right : frames.left)
          : (up > 0 ? frames.back : frames.front);
        if (region !== sprite.getFrameRegion()) sprite.setFrameRegion(region);
        root.setEnabled(true);
      },
    });

    return () => {
      stop();
      releasePrescale();
      defaultSprite.dispose?.();
      root.dispose();
    };
  },
};
