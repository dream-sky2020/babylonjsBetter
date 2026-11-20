import { TransformNode } from '@babylonjs/core';
import { getDungeonMovementDirectionVector } from '@/core/dungeon-movement/dungeonMovement.direction';
import { mapDungeonDisplayPosition } from '@/core/dungeon-view/dungeonOverheadView';
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
const maxOffsetPercent = 50;
const centeredOffsets = { 'foot-offset-x': 0, 'foot-offset-z': 0 };
type PlayerAppearanceConfig = typeof centeredOffsets & { 'world-height': number | null };
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
    const appearance = config ? config.register(moduleId, {
      'foot-offset-x': offsetField,
      'foot-offset-z': offsetField,
      'world-height': {
        defaultValue: null,
        valid: value => value === null || (typeof value === 'number' && Number.isFinite(value) && value > 0),
      },
    }) as PlayerAppearanceConfig : { ...centeredOffsets, 'world-height': null };

    const panel = context.ui.addPanel(moduleId, '玩家外观');
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

    const sprite = createAtlasSpritePlane(context.scene, 'resources/神彩怒放主角.png', 1, {
      pixelArt: true,
      deformation: false,
    });
    sprite.mesh.name = 'dungeon-player-sprite';
    sprite.mesh.parent = root;
    sprite.mesh.isPickable = false;
    sprite.setFrameRegion(frames.front);

    let displayedHeight: number | undefined;
    const stop = context.scheduler.register({
      id: 'sync-sprite', phase: 'presentation', order: 110, description: '同步玩家精灵的位置与朝向',
      run() {
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
      sprite.dispose?.();
      root.dispose();
    };
  },
};
