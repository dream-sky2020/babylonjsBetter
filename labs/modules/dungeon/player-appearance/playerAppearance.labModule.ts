import { Constants, TransformNode } from '@babylonjs/core';
import { getDungeonMovementDirectionVector } from '@/core/dungeon-movement/dungeonMovement.direction';
import { mapDungeonDisplayPosition } from '@/core/dungeon-view/dungeonOverheadView';
import { resolveAppAssetUrl } from '@/core/resources/appAssetUrl';
import { createAtlasSpritePlane } from '@/core/sprite/render/createAtlasSpritePlane';
import type { SpriteFrameRegion } from '@/core/sprite/types/sprite.types';
import type { LabModule } from '@/labs/kit';
import { createLabStatus, createLabSwitch } from '@/labs/kit/labUi';
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
  atlasSize: { w: 62, h: 83 },
  rotated: false,
  trimmed: false,
});

const frames = {
  back: frame('back', 0, 1),
  right: frame('right', 32, 1),
  front: frame('front', 0, 43),
  left: frame('left', 32, 43),
};
const directionPreviews = [
  { region: frames.back, x: 0, y: 1 },
  { region: frames.front, x: 0, y: -1 },
  { region: frames.left, x: -1, y: 0 },
  { region: frames.right, x: 1, y: 0 },
];

const moduleId = 'player-appearance';
const atlasPath = 'resources/神彩怒放主角.png';
const additionalAtlasPaths = ['resources/神彩怒放主角2.png', 'resources/神彩怒放主角3.png'];
const comparisonAtlasPaths = [atlasPath, ...additionalAtlasPaths];
const comparisonFrames = [frames.front, frames.back, frames.left, frames.right];
type ComparisonLayout = 'rows' | 'left-rows' | 'crosses';
const isComparisonLayout = (value: unknown): value is ComparisonLayout =>
  value === 'rows' || value === 'left-rows' || value === 'crosses';
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
  'debug-directions': boolean;
  'debug-compare-atlases': boolean;
  'comparison-layout': ComparisonLayout;
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
      'debug-directions': {
        defaultValue: false,
        valid: value => typeof value === 'boolean',
      },
      'debug-compare-atlases': {
        defaultValue: false,
        valid: value => typeof value === 'boolean',
      },
      'comparison-layout': {
        defaultValue: 'rows',
        valid: isComparisonLayout,
      },
      'world-height': {
        defaultValue: null,
        valid: value => value === null || (typeof value === 'number' && Number.isFinite(value) && value > 0),
      },
    }) as PlayerAppearanceConfig : {
      ...centeredOffsets, 'world-height': null, 'texture-sampling': defaultSampling,
      'debug-directions': false, 'debug-compare-atlases': false, 'comparison-layout': 'rows',
    };

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
    const debugDirections = createLabSwitch('调试：对比四方向精灵', appearance['debug-directions']);
    debugDirections.input.dataset.labSetting = 'debug-directions';
    const debugComparison = createLabSwitch('调试：角色图对比', appearance['debug-compare-atlases']);
    debugComparison.input.dataset.labSetting = 'debug-compare-atlases';
    const comparisonLayoutRow = document.createElement('label');
    comparisonLayoutRow.className = 'lab-field';
    comparisonLayoutRow.textContent = '对比布局';
    const comparisonLayout = document.createElement('select');
    comparisonLayout.dataset.labSetting = 'comparison-layout';
    comparisonLayout.append(
      new Option('右侧三行四列', 'rows'),
      new Option('左侧三行四列', 'left-rows'),
      new Option('左、右、上各一组四方向', 'crosses'),
    );
    comparisonLayout.value = appearance['comparison-layout'];
    comparisonLayoutRow.append(comparisonLayout);
    comparisonLayoutRow.hidden = !debugComparison.input.checked;
    const comparisonStatus = createLabStatus('');
    comparisonStatus.hidden = !debugComparison.input.checked;
    panel.content.append(samplingRow, samplingStatus, debugDirections.row, debugComparison.row, comparisonLayoutRow, comparisonStatus);
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

    function createSprite(path: string, name: string, region = frames.front) {
      const sprite = createAtlasSpritePlane(context.scene, path, 1, { deformation: false });
      sprite.mesh.name = name;
      sprite.mesh.parent = root;
      sprite.mesh.isPickable = false;
      sprite.setFrameRegion(region);
      return sprite;
    }
    const defaultSprite = createSprite(atlasPath, 'dungeon-player-sprite');
    let prescaledSprite: ReturnType<typeof createSprite> | undefined;
    let cancelPrescale: (() => void) | undefined;
    let cancelComparisonPrescale: (() => void)[] = [];
    let prescaledComparisonPaths: (string | null)[] = [];
    let displayedSprite = defaultSprite;
    let displayedHeight: number | undefined;
    let previewAtlas: string | undefined;
    let previewHeight: number | undefined;
    let previewSprites: ReturnType<typeof createSprite>[] = [];
    let comparisonPaths: readonly string[] = [];
    let comparisonHeight: number | undefined;
    let displayedComparisonLayout: ComparisonLayout | undefined;
    let comparisonSamplingFailed = false;
    let comparisonSprites: ReturnType<typeof createSprite>[] = [];

    function createPreview(path: string, name: string, region: SpriteFrameRegion) {
      const preview = createSprite(path, name, region);
      // 对比面片跟随屏幕方向，下方的面片需要显示在地板前。
      preview.surface.material.depthFunction = Constants.ALWAYS;
      preview.surface.material.disableDepthWrite = true;
      return preview;
    }

    function disposePreviews() {
      for (const preview of previewSprites) preview.dispose?.();
      previewSprites = [];
      previewAtlas = undefined;
      previewHeight = undefined;
    }

    function syncPreviews(path: string, height: number) {
      if (path !== previewAtlas) {
        disposePreviews();
        previewAtlas = path;
        previewSprites = directionPreviews.map(({ region }) =>
          createPreview(path, `dungeon-player-preview-${region.frameName}`, region));
      }
      if (height === previewHeight) return;
      previewHeight = height;
      const width = height * frameSize.w / frameSize.h;
      for (const [index, preview] of previewSprites.entries()) {
        const { x, y } = directionPreviews[index];
        preview.setDisplayScale(height);
        preview.mesh.position.set(x * width * 1.2, height / 2 + y * height * 1.2, 0);
      }
    }

    function disposeComparison() {
      for (const preview of comparisonSprites) preview.dispose?.();
      comparisonSprites = [];
      comparisonPaths = [];
      comparisonHeight = undefined;
    }

    function syncComparison(height: number) {
      const original = prescaledSprite?.texture;
      const scaled = prescaledComparisonPaths.filter(path => path !== null);
      const paths = original?.isReady() && original.url && scaled.length === additionalAtlasPaths.length
        ? [original.url, ...scaled] : comparisonAtlasPaths;
      if (paths.some((path, index) => path !== comparisonPaths[index])) {
        disposeComparison();
        comparisonPaths = paths;
        comparisonSprites = paths.flatMap((path, row) => comparisonFrames.map(region => {
          const preview = createPreview(path, `dungeon-player-comparison-${row + 1}-${region.frameName}`, region);
          preview.mesh.setEnabled(false);
          return preview;
        }));
      }
      const layout = appearance['comparison-layout'];
      if (height !== comparisonHeight || layout !== displayedComparisonLayout) {
        comparisonHeight = height;
        displayedComparisonLayout = layout;
        const width = height * frameSize.w / frameSize.h;
        for (const [index, preview] of comparisonSprites.entries()) {
          const column = index % comparisonFrames.length;
          const row = Math.floor(index / comparisonFrames.length);
          preview.setDisplayScale(height);
          if (layout === 'crosses') {
            const { x, y } = directionPreviews.find(direction => direction.region === comparisonFrames[column])!;
            const center = appearance['debug-directions'] ? 3.6 : 2.5;
            const centerX = row === 2 ? 0 : (row === 0 ? -center : center);
            const centerY = row === 2 ? 0.5 + center : 0.5;
            preview.mesh.position.set(width * (centerX + x * 1.2), height * (centerY + y * 1.2), 0);
          } else {
            const startX = layout === 'left-rows' ? -2.5 - (comparisonFrames.length - 1) * 1.2 : 2.5;
            preview.mesh.position.set(width * (startX + column * 1.2), height * (0.5 + (1 - row) * 1.2), 0);
          }
        }
      }
      const ready = comparisonSprites.every(preview => preview.texture.isReady());
      for (const preview of comparisonSprites) preview.mesh.setEnabled(ready);
    }

    debugDirections.input.addEventListener('change', () => {
      const enabled = debugDirections.input.checked;
      if (config) config.update(moduleId, { 'debug-directions': enabled });
      else appearance['debug-directions'] = enabled;
      comparisonHeight = undefined;
      if (!enabled) disposePreviews();
    });

    function showSprite(sprite: ReturnType<typeof createSprite>) {
      if (sprite === displayedSprite) return;
      displayedSprite.mesh.setEnabled(false);
      sprite.mesh.setEnabled(true);
      displayedSprite = sprite;
      displayedHeight = undefined;
    }

    function releasePrescale() {
      cancelPrescale?.();
      cancelPrescale = undefined;
      prescaledSprite?.dispose?.();
      prescaledSprite = undefined;
    }

    function loadPrescaledAtlas(path: string, factor: number, onLoad: (url: string) => void, onError: () => void) {
      const image = new Image();
      const cancel = () => {
        image.onload = null;
        image.onerror = null;
      };
      image.onerror = () => { cancel(); onError(); };
      image.onload = () => {
        cancel();
        try {
          const canvas = document.createElement('canvas');
          canvas.width = image.naturalWidth * factor;
          canvas.height = image.naturalHeight * factor;
          const drawing = canvas.getContext('2d');
          if (!drawing) {
            onError();
            return;
          }
          drawing.imageSmoothingEnabled = false;
          drawing.drawImage(image, 0, 0, canvas.width, canvas.height);
          // 整张图集等比放大，方向帧的 UV 比例与面片尺寸沿用原值。
          onLoad(canvas.toDataURL('image/png'));
        } catch {
          onError();
        }
      };
      image.src = resolveAppAssetUrl(path);
      return cancel;
    }

    function loadPrescaledSprite(factor: number) {
      cancelPrescale = loadPrescaledAtlas(atlasPath, factor, url => {
        prescaledSprite = createSprite(url, 'dungeon-player-sprite-prescaled');
        prescaledSprite.mesh.setEnabled(false);
      }, () => {
        samplingStatus.textContent = '预放大贴图加载失败，当前使用默认三线性。';
        samplingStatus.hidden = false;
      });
    }

    function syncComparisonStatus() {
      const legend = appearance['comparison-layout'] === 'crosses'
        ? '左：主角1 · 右：主角2 · 上：主角3。每组上背、下正，左右对应侧向。'
        : '从上到下：主角1、主角2、主角3。从左到右：正、背、左、右。';
      comparisonStatus.textContent = comparisonSamplingFailed
        ? `${legend} 图集预放大失败，三组均使用默认三线性。` : legend;
    }

    function refreshComparisonSampling() {
      cancelComparisonPrescale.forEach(cancel => cancel());
      cancelComparisonPrescale = [];
      prescaledComparisonPaths = additionalAtlasPaths.map(() => null);
      comparisonSamplingFailed = false;
      syncComparisonStatus();
      const value = appearance['texture-sampling'];
      if (appearance['debug-compare-atlases'] && value !== defaultSampling) {
        cancelComparisonPrescale = additionalAtlasPaths.map((path, index) =>
          loadPrescaledAtlas(path, prescaleFactors[value], url => {
            prescaledComparisonPaths[index] = url;
          }, () => {
            comparisonSamplingFailed = true;
            syncComparisonStatus();
          }));
      }
    }

    debugComparison.input.addEventListener('change', () => {
      const enabled = debugComparison.input.checked;
      if (config) config.update(moduleId, { 'debug-compare-atlases': enabled });
      else appearance['debug-compare-atlases'] = enabled;
      comparisonLayoutRow.hidden = !enabled;
      comparisonStatus.hidden = !enabled;
      refreshComparisonSampling();
      if (!enabled) disposeComparison();
    });
    comparisonLayout.addEventListener('change', () => {
      const value = comparisonLayout.value;
      if (!isComparisonLayout(value)) return;
      if (config) config.update(moduleId, { 'comparison-layout': value });
      else appearance['comparison-layout'] = value;
      syncComparisonStatus();
    });

    sampling.addEventListener('change', () => {
      const value = sampling.value;
      if (!isTextureSampling(value)) return;
      if (config) config.update(moduleId, { 'texture-sampling': value });
      else appearance['texture-sampling'] = value;
      samplingStatus.hidden = true;
      showSprite(defaultSprite);
      releasePrescale();
      if (value !== defaultSampling) loadPrescaledSprite(prescaleFactors[value]);
      refreshComparisonSampling();
    });
    const initialSampling = appearance['texture-sampling'];
    if (initialSampling !== defaultSampling) loadPrescaledSprite(prescaleFactors[initialSampling]);
    refreshComparisonSampling();

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
        if (appearance['debug-directions'] && sprite.texture.url) syncPreviews(sprite.texture.url, height);
        if (appearance['debug-compare-atlases']) syncComparison(height);
        root.setEnabled(true);
      },
    });

    return () => {
      stop();
      disposePreviews();
      cancelComparisonPrescale.forEach(cancel => cancel());
      disposeComparison();
      releasePrescale();
      defaultSprite.dispose?.();
      root.dispose();
    };
  },
};
