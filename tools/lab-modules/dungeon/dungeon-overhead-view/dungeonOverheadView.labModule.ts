import { DEFAULT_OVERHEAD_VIEW, parseOverheadView, resolveOverheadView, selectDungeonDisplayView, type DungeonOverheadViewConfig, type DungeonViewConsumer, type DungeonViewLease, type ResolvedDungeonView } from '@/core/dungeon-view/dungeonOverheadView.ts';
import { readDungeonOverheadView } from '@/core/dungeon-view/dungeonOverheadView.document.ts';
import { createLabSwitch, type LabModule } from '@/tools/lab-kit';
import { dungeonMapChangedEvent } from '../dungeon-map-loader/dungeonMapLoader.protocol';
import { DUNGEON_MAP_LOADER_REFERENCES_SERVICE_KEY, type DungeonMapLoaderReferences } from '../dungeon-map-loader/dungeonMapLoader.references';
import { DUNGEON_PLAYER_CAMERA_SERVICE_KEY, type DungeonPlayerCameraService } from '../dungeon-player-camera/dungeonPlayerCamera.references';
import { DUNGEON_PLAYER_CAMERA_VIEW_SERVICE_KEY } from '../dungeon-player-camera/dungeonPlayerCamera.view';
import { PLAYER_MOVEMENT_VIEW_SERVICE_KEY } from '../player-movement/playerMovement.view';
import { DUNGEON_GRID_VIEW_SERVICE_KEY } from '../dungeon-grid/dungeonGrid.view';
import { DUNGEON_TRAVERSAL_VIEW_SERVICE_KEY } from '../dungeon-traversal/dungeonTraversal.view';
import { DUNGEON_MOVEMENT_VIEW_SERVICE_KEY } from '../dungeon-movement/dungeonMovement.view';
import { DUNGEON_OBSTACLE_VIEW_SERVICE_KEY } from '../dungeon-obstacle/dungeonObstacle.view';
import { DUNGEON_OVERHEAD_VIEW_SERVICE_KEY, type DungeonOverheadViewService } from './dungeonOverheadView.references';

type Settings = { enabled: boolean; draft: DungeonOverheadViewConfig | null };
const validateSettings = (value: unknown, version: number): Settings => {
  if (version !== 1 || !value || typeof value !== 'object') throw new Error('俯视设置版本或格式无效');
  const v = value as Record<string, unknown>;
  if (typeof v.enabled !== 'boolean') throw new Error('enabled 必须为布尔值');
  return { enabled: v.enabled, draft: v.draft === null ? null : parseOverheadView(v.draft) };
};

/** Optional coordinator: consumers own their resources; map data remains authoritative. */
export const dungeonOverheadViewLabModule: LabModule = {
  id: 'dungeon-overhead-view',
  dependencies: ['dungeon-map-loader', 'dungeon-player-camera', 'player-movement', 'dungeon-grid', 'dungeon-traversal', 'dungeon-movement', 'dungeon-obstacle'],
  setup(context) {
    const references = context.services.get<DungeonMapLoaderReferences>(DUNGEON_MAP_LOADER_REFERENCES_SERVICE_KEY);
    const camera = context.services.get<DungeonPlayerCameraService>(DUNGEON_PLAYER_CAMERA_SERVICE_KEY);
    const consumers = [PLAYER_MOVEMENT_VIEW_SERVICE_KEY, DUNGEON_GRID_VIEW_SERVICE_KEY, DUNGEON_TRAVERSAL_VIEW_SERVICE_KEY, DUNGEON_MOVEMENT_VIEW_SERVICE_KEY, DUNGEON_OBSTACLE_VIEW_SERVICE_KEY, DUNGEON_PLAYER_CAMERA_VIEW_SERVICE_KEY]
      .map(key => context.services.get<DungeonViewConsumer>(key));
    const panel = context.ui.addPanel('dungeon-overhead-view', '俯视显示');
    const toggle = createLabSwitch('启用俯视显示协调', true);
    const restoreDisplayInFirstPerson = createLabSwitch('切到第一人称时恢复格子与玩家显示原比例', false);
    const transitionSection = document.createElement('section'); transitionSection.className = 'lab-overhead-transition-settings';
    const transitionTitle = document.createElement('strong'); transitionTitle.textContent = '切换视角后的显示';
    const transitionControls = document.createElement('div'); transitionControls.className = 'lab-overhead-transition-controls';
    const transitionHint = document.createElement('small'); transitionHint.textContent = '接入显示变形模块后，有效俯视配置会自动启用变形；下方“应用测试草稿”会同时应用这里的切换设置。强度与规则仍在批量控制面板。';
    transitionSection.append(transitionTitle, restoreDisplayInFirstPerson.row, transitionControls, transitionHint);
    const status = document.createElement('p');
    status.dataset.overheadStatus = '';
    const help = document.createElement('p');
    help.textContent = '读取地图级俯视显示实体。没有配置时保持原布局；应用草稿可临时测试，通过 Lab Snapshot 保存。自动补偿仅支持正交与水平朝向 0° / ±180°。';
    panel.content.append(toggle.row, transitionSection, help);
    type EditableField = Exclude<keyof DungeonOverheadViewConfig, 'restoreDisplayInFirstPerson'>;
    const fields = new Map<EditableField, HTMLInputElement | HTMLSelectElement>();
    const labels: Record<EditableField, string> = {
      pitchDeg: '俯视角（与地面夹角，15–89.99°）', yawDeg: '水平朝向（°）', projection: '投影',
      orthographicSize: '正交垂直可见半范围', proportion: '格子显示比例', screenAspect: '目标屏幕高 / 宽', scaleX: '手动 X 倍率', scaleZ: '手动 Z 倍率',
    };
    for (const key of Object.keys(labels) as EditableField[]) {
      const row = document.createElement('label'); row.className = 'lab-field'; row.textContent = labels[key];
      let input: HTMLInputElement | HTMLSelectElement;
      if (key === 'projection' || key === 'proportion') {
        input = document.createElement('select');
        const options = key === 'projection' ? [['orthographic', '正交'], ['perspective', '透视']]
          : [['original', '原比例'], ['compensate', '按角度补偿'], ['manual', '手动比例']];
        for (const [value, label] of options) input.append(new Option(label, value));
      } else { input = document.createElement('input'); input.type = 'number'; input.step = 'any'; }
      input.dataset.overheadField = key; fields.set(key, input); row.append(input); panel.content.append(row);
    }
    const apply = document.createElement('button'); apply.textContent = '应用测试草稿';
    const reset = document.createElement('button'); reset.textContent = '恢复地图配置（无配置则原布局）';
    panel.content.append(apply, reset, status);
    const settings: Settings = { enabled: true, draft: null };
    let leases: DungeonViewLease[] = [];
    let resolved: ResolvedDungeonView | null = null;
    let effective: ResolvedDungeonView | null = null;
    let displayed: ResolvedDungeonView | null = null;
    const viewListeners = new Set<() => void>();
    let transitionApply: (() => void) | null = null;
    let previousMode: DungeonPlayerCameraService['mode'] | null = null;
    let updating = false;
    const release = () => {
      const owned = leases; leases = []; resolved = null; effective = null; displayed = null;
      owned.forEach(lease => lease.release());
      const restore = previousMode; previousMode = null;
      if (restore !== null) camera.setMode(restore);
    };
    const syncEffective = () => {
      if (updating) return;
      const next = camera.mode === 'overhead' && camera.bindingEnabled ? resolved : null;
      const nextDisplay = camera.bindingEnabled && camera.mode === 'first-person'
        ? selectDungeonDisplayView(null, resolved) : next;
      const before = displayed;
      try { leases.forEach(lease => lease.apply(nextDisplay)); effective = next; displayed = nextDisplay; }
      catch (error) { leases.forEach(lease => lease.apply(before)); throw error; }
      viewListeners.forEach(listener => listener());
      status.textContent = !resolved ? '原布局：没有启用的地图配置或测试草稿。'
        : !effective ? displayed ? '俯视相机已暂停；地图显示比例在当前视角继续生效。' : '俯视显示已暂停；地图恢复原比例。'
          : `${settings.draft ? '测试草稿' : '地图组件'} · ${resolved.config.pitchDeg}° · X ${resolved.scaleX.toFixed(3)} / Z ${resolved.scaleZ.toFixed(3)}；不改变移动数据。`;
    };
    const syncForm = () => {
      const config = settings.draft ?? resolved?.config ?? DEFAULT_OVERHEAD_VIEW;
      fields.forEach((input, key) => { input.value = String(config[key]); });
      restoreDisplayInFirstPerson.input.checked = config.restoreDisplayInFirstPerson;
      toggle.input.checked = settings.enabled;
      syncApplicableFields();
    };
    const syncApplicableFields = () => {
      fields.get('orthographicSize')!.disabled = fields.get('projection')!.value !== 'orthographic';
      fields.get('screenAspect')!.disabled = fields.get('proportion')!.value !== 'compensate';
      for (const key of ['scaleX', 'scaleZ'] as const) fields.get(key)!.disabled = fields.get('proportion')!.value !== 'manual';
    };
    const reconcile = () => {
      updating = true;
      try {
        const loaded = references.current;
        const config = settings.enabled && loaded ? settings.draft ?? readDungeonOverheadView(loaded.document) : null;
        const next = config && loaded ? resolveOverheadView(config, loaded.sceneBinding.component.mapOffset, loaded.sceneBinding.component.tileSize) : null;
        if (!next) release();
        else {
          if (!leases.length) {
            try { consumers.forEach(consumer => leases.push(consumer.acquire('dungeon-overhead-view'))); }
            catch (error) { release(); throw error; }
            previousMode = camera.mode;
            if (camera.bindingEnabled) camera.setMode('overhead');
          }
          resolved = next;
        }
      } catch (error) {
        release(); viewListeners.forEach(listener => listener()); throw error;
      } finally { updating = false; }
      syncEffective(); syncForm();
    };
    const safelyReconcile = () => { try { reconcile(); } catch (error) { status.textContent = String(error); } };
    const registration = context.labState.registerReference({ moduleId: 'dungeon-overhead-view', key: 'settings', version: 1, value: settings,
      inspect: value => ({ ...value }), save: {
        serialize: value => ({ ...value }), validate: validateSettings,
        restore: (value, saved) => { Object.assign(value, saved); }, afterRestore: safelyReconcile,
      },
    });
    const service: DungeonOverheadViewService = {
      get view() { return effective; },
      get configuredView() { return resolved; },
      get displayedView() { return displayed; },
      subscribe(listener) { viewListeners.add(listener); return () => { viewListeners.delete(listener); }; },
      mountTransitionControl(row, applyTransition) {
        if (transitionApply) throw new Error('切换视角设置已被其他模块接入');
        transitionControls.append(row); transitionApply = applyTransition;
        return () => { if (transitionApply !== applyTransition) return; transitionApply = null; row.remove(); };
      },
      setDraft(config) { settings.draft = config === null ? null : parseOverheadView(config); reconcile(); registration.markChanged(); },
      setEnabled(enabled) { settings.enabled = enabled; reconcile(); registration.markChanged(); },
    };
    context.services.set(DUNGEON_OVERHEAD_VIEW_SERVICE_KEY, service);
    apply.addEventListener('click', () => {
      try {
        const raw = { ...Object.fromEntries([...fields].map(([key, input]) => [key, input instanceof HTMLSelectElement ? input.value : Number(input.value)])),
          restoreDisplayInFirstPerson: restoreDisplayInFirstPerson.input.checked };
        const config = parseOverheadView(raw);
        transitionApply?.();
        service.setDraft(config);
      } catch (error) { status.textContent = String(error); }
    });
    reset.addEventListener('click', () => { settings.draft = null; safelyReconcile(); registration.markChanged(); });
    toggle.input.addEventListener('change', () => { settings.enabled = toggle.input.checked; safelyReconcile(); registration.markChanged(); });
    fields.get('projection')!.addEventListener('change', syncApplicableFields);
    fields.get('proportion')!.addEventListener('change', syncApplicableFields);
    const offCamera = camera.subscribe(syncEffective);
    const offMap = context.communication.on(dungeonMapChangedEvent, safelyReconcile);
    safelyReconcile();
    return () => {
      offCamera(); offMap(); updating = true; release(); viewListeners.forEach(listener => listener()); viewListeners.clear(); registration.unregister();
      context.services.delete(DUNGEON_OVERHEAD_VIEW_SERVICE_KEY); panel.root.remove();
    };
  },
};
