import { MonsterVisualRuntime } from '@/core/monster/visual/MonsterVisualRuntime';
import { MONSTER_RENDER_ORDER } from '@/core/monster/config/monsterConfig';
import type { MonsterDisplayConfig } from '@/core/monster/types/monster.types';
import type { MonsterVisualResources, VisualBattlefield } from '@/core/monster/visual/monsterVisual.types';
import type { LabModule } from '@/labs/kit';
import { MONSTER_BATTLEFIELD, MONSTER_VISUAL_LIBRARIES, MONSTER_VISUAL_SETTINGS, MONSTER_SELECTION } from '../monsterVisual.memory';
import { monsterBattlefieldChanged, monsterLibrariesChanged, monsterSelectionChanged, monsterSelectionCommand, monsterVisualActionChanged, monsterVisualCommand, monsterBattlefieldCommand } from '../monsterVisual.protocol';
import { createMonsterPanel, fillMonsterSelect } from '../monsterModuleUi';
import { persistMonsterState } from '../monsterModuleState';
import { MONSTER_VISUAL_SERVICE } from './monsterVisual.service';
import { MonsterActionLifecycle } from './monsterActionLifecycle';

export const monsterVisualLabModule: LabModule = {
  id: 'monster-visual', dependencies: ['monster-visual-libraries', 'monster-battlefield'],
  events: [{ definition: monsterVisualActionChanged, publishes: true }],
  setup(context) {
    const libraries = context.memory.acquire(MONSTER_VISUAL_LIBRARIES), field = context.memory.acquire(MONSTER_BATTLEFIELD);
    const settings = context.memory.acquire(MONSTER_VISUAL_SETTINGS), selection = context.memory.acquire(MONSTER_SELECTION);
    const runtime = new MonsterVisualRuntime(context.scene);
    let treeSelectionRequests = 0;
    const objectRegistration = context.objects?.register({
      id: 'monster-instances', label: '怪物实例', roots: () => [runtime.renderer.rootNode],
      objects: () => (field.current?.monsters ?? []).flatMap(monster => {
        const node = runtime.renderer.getMonsterNode(monster.id);
        return node ? [{ id: monster.id, name: `${libraries.current?.configs[monster.monsterConfigKey]?.name ?? monster.monsterConfigKey} · ${monster.id.slice(0, 8)}`,
          node, kind: '怪物实例' }] : [];
      }),
      async onSelect(id) {
        treeSelectionRequests++;
        try { await context.communication.request(monsterSelectionCommand, { selectedId: id ?? '' }); }
        finally { treeSelectionRequests--; }
      },
    });
    const actions = new MonsterActionLifecycle(event => { void context.communication.publish(monsterVisualActionChanged, event); });
    const displayCache = new Map<string, { source: MonsterDisplayConfig; signature: string; config: MonsterDisplayConfig }>();
    let started = false, disposed = false, lastGeneration = 0;
    const applySettings = () => {
      for (const monster of field.current?.monsters ?? []) for (const layer of MONSTER_RENDER_ORDER) {
        const mesh = runtime.renderer.getMonsterLayerMesh(monster.id, layer); if (mesh) mesh.showBoundingBox = settings.current.boundingBoxes;
      }
    };
    const sync = () => {
      if (!started || disposed || !field.current || !libraries.current) return;
      const resources: MonsterVisualResources = { ...libraries.current, configs: { ...libraries.current.configs } };
      const battlefield: VisualBattlefield = { ...field.current, monsters: field.current.monsters.map(monster => {
        if (!monster.display) return monster;
        const source = resources.configs[monster.monsterConfigKey]; if (!source) return monster;
        const key = '@instance:' + monster.id, signature = JSON.stringify(monster.display), cached = displayCache.get(monster.id);
        const config = cached?.source === source && cached.signature === signature ? cached.config : { ...source, ...monster.display, id: key };
        displayCache.set(monster.id, { source, signature, config }); resources.configs[key] = config;
        return { ...monster, monsterConfigKey: key };
      }) };
      runtime.sync(battlefield, resources, selection.current.selectedId);
      const ids = new Set(field.current.monsters.map(monster => monster.id)); for (const id of displayCache.keys()) if (!ids.has(id)) displayCache.delete(id);
      applySettings();
      objectRegistration?.refresh();
    };
    context.services.set(MONSTER_VISUAL_SERVICE, { runtime, sync,
      assertPlayable(id) {
        if (!started || disposed) throw new Error('怪物显示模块尚未就绪。');
        if (settings.current.paused || context.scheduler.isPaused) throw new Error('请先恢复怪物表现播放。');
        if (!field.require().monsters.some(monster => monster.id === id)) throw new Error('怪物实例不存在。');
      },
      registerAction: (kind, stop) => actions.register(kind, stop), begin: (id, kind, play) => actions.begin(id, kind, play), cancel: (id, kind) => actions.cancel(id, kind),
    });
    context.communication.on(monsterBattlefieldChanged, event => {
      if (!started || event.generation <= lastGeneration) return; lastGeneration = event.generation;
      if (event.kind !== 'move') actions.cancel(event.monsterId);
      if (event.kind === 'replace') runtime.clear();
      sync(); objectRegistration?.select(selection.current.selectedId || null, { onlyIfSelected: true }); render();
    });
    context.communication.on(monsterLibrariesChanged, () => { if (started) { actions.cancel(); runtime.clear(); sync(); render(); } });
    context.communication.on(monsterSelectionChanged, () => { sync(); if (!treeSelectionRequests) objectRegistration?.select(selection.current.selectedId || null); render(); });
    context.communication.handle(monsterVisualCommand, command => { if (command.kind === 'reset') { actions.cancel(command.monsterId); sync(); } else applySettings(); });
    const panel = createMonsterPanel(context, 'monster-visual', '怪物外观与显示');
    const config = panel.select('当前实例外观', 'config'), stripe = panel.select('条纹预设', 'stripe');
    const patch = (data: { configKey?: string; stripeKey?: string; display?: import('../monsterBattlefield.model').MonsterDisplayOverrides | null }) =>
      context.communication.request(monsterBattlefieldCommand, { kind: 'patch', monsterId: selection.current.selectedId, ...data });
    config.addEventListener('change', () => void panel.run(() => patch({ configKey: config.value })));
    stripe.addEventListener('change', () => void panel.run(() => patch({ stripeKey: stripe.value })));
    const scale = panel.number('怪物大小', 'scale', 1, 10000, 1), sceneScale = panel.number('3D 场景倍率', 'scene-scale', .01, 100, .1);
    const height = panel.number('高度 Y', 'height', -1000, 1000, .1), offset = panel.number('水平偏移 X', 'offset-x', -1000, 1000, .1);
    const facing = panel.select('精灵面向轴', 'facing'); fillMonsterSelect(facing, [['+Z', '+Z'], ['-Z', '-Z']], '+Z');
    const apply = panel.button('应用实例显示参数', 'display', () => patch({ display: { scaleSize: Number(scale.value), scene3dScale: Number(sceneScale.value), scene3dHeight: Number(height.value), scene3dOffsetX: Number(offset.value), spriteFacingAxis: facing.value as '+Z' | '-Z' } }));
    const restore = panel.button('恢复实例预设参数', 'restore-display', () => patch({ display: null }));
    const boxes = panel.toggle('显示图层包围盒', 'boxes'), paused = panel.toggle('暂停全部怪物表现（相机可操作）', 'paused');
    boxes.addEventListener('change', () => { settings.replace({ ...settings.current, boundingBoxes: boxes.checked }); state.changed(); applySettings(); });
    paused.addEventListener('change', () => { settings.replace({ ...settings.current, paused: paused.checked }); state.changed(); });
    panel.button('停止并恢复全部怪物', 'reset', () => { actions.cancel(); sync(); });
    const link = document.createElement('a'); link.href = '../../standalone/monster-3d-visual-lab/index.html'; link.textContent = '打开外观配置编辑器'; panel.append(link);
    const render = () => {
      if (!libraries.current || !field.current) return;
      const monster = field.current.monsters.find(item => item.id === selection.current.selectedId);
      fillMonsterSelect(config, Object.entries(libraries.current.configs).map(([key, item]) => [key, item.name]), monster?.monsterConfigKey ?? '');
      fillMonsterSelect(stripe, [['', '跟随外观预设'], ...Object.entries(libraries.current.monsterStripes).map(([key, item]): [string, string] => [key, item.name])], monster?.monsterStripePresetKey ?? '');
      config.disabled = stripe.disabled = apply.disabled = restore.disabled = !monster;
      const display = monster ? { ...libraries.current.configs[monster.monsterConfigKey], ...monster.display } : null;
      if (display) { scale.value = String(display.scaleSize); sceneScale.value = String(display.scene3dScale); height.value = String(display.scene3dHeight); offset.value = String(display.scene3dOffsetX); facing.value = display.spriteFacingAxis; }
      boxes.checked = settings.current.boundingBoxes; paused.checked = settings.current.paused;
    };
    const state = persistMonsterState(context, 'monster-visual', 'settings', MONSTER_VISUAL_SETTINGS, settings,
      () => { if (started) { applySettings(); render(); } }, [{ moduleId: 'monster-visual-debug', key: 'settings', select: saved => {
        const value = saved as { boundingBoxes?: unknown; paused?: unknown }; return { boundingBoxes: value?.boundingBoxes, paused: value?.paused };
      } }]);
    const stop = context.scheduler.register({ id: 'monster-visual-update', phase: 'presentation', order: 200, description: '统一推进已安装的怪物视觉能力',
      enabled: () => started && !settings.current.paused && !context.scheduler.isPaused, run: dt => runtime.update(dt) });
    return { start() { started = true; sync(); objectRegistration?.select(selection.current.selectedId || null); render(); panel.root.dataset.monsterReady = 'true'; }, dispose() {
      objectRegistration?.dispose(); actions.cancel(); disposed = true; started = false; stop(); state.dispose(); runtime.dispose(); displayCache.clear(); panel.root.remove();
    } };
  },
};
