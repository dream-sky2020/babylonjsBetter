import { createLabField, createLabStatus, createLabSwitch, type LabModule, type LabStateJsonValue } from '@/labs/kit';
import { MONSTER_BATTLEFIELD, MONSTER_VISUAL_LIBRARIES, MONSTER_VISUAL_SETTINGS } from '../monsterVisual.memory';
import { monsterBattlefieldCommand, monsterBattlefieldChanged, monsterLibrariesChanged, monsterLibrariesReload,
  monsterVisualActionChanged, monsterVisualCommand } from '../monsterVisual.protocol';
import type { MonsterDisplayOverrides } from '../monsterBattlefield.model';
import type { BattlefieldCommand } from '../monsterVisual.protocol';

export const monsterVisualDebugLabModule: LabModule = {
  id: 'monster-visual-debug', dependencies: ['monster-visual-libraries', 'monster-battlefield', 'monster-visual'],
  setup(context) {
    const libraries = context.memory.acquire(MONSTER_VISUAL_LIBRARIES);
    const field = context.memory.acquire(MONSTER_BATTLEFIELD);
    const settings = context.memory.acquire(MONSTER_VISUAL_SETTINGS);
    const panel = context.ui.addPanel('monster-visual-test', '怪物视觉测试');
    // Keep this module's test controls immediately after the shared layout toolbar.
    context.ui.sidebar.insertBefore(panel.root, context.ui.sidebar.children[1] ?? null);
    const status = createLabStatus('正在加载怪物视觉…'); status.dataset.monsterStatus = '';
    const controls: HTMLButtonElement[] = [];
    const perform = async (work: () => Promise<unknown>) => {
      try { await work(); status.dataset.error = 'false'; }
      catch (error) { status.textContent = error instanceof Error ? error.message : String(error); status.dataset.error = 'true'; }
    };
    const button = (text: string, id: string, action: () => Promise<unknown>) => {
      const el = document.createElement('button'); el.type = 'button'; el.textContent = text; el.dataset.monsterAction = id;
      el.addEventListener('click', () => void perform(action)); controls.push(el); return el;
    };
    const select = (label: string, id: string) => {
      const el = document.createElement('select'); el.dataset.monsterControl = id; panel.content.append(createLabField(label, el)); return el;
    };
    const fill = (el: HTMLSelectElement, entries: Array<[string, string]>, value: string) => {
      el.replaceChildren(...entries.map(([key, name]) => { const option = document.createElement('option'); option.value = key; option.textContent = name; return option; }));
      el.value = entries.some(([key]) => key === value) ? value : entries[0]?.[0] ?? '';
    };
    const monsterSelect = select('怪物实例', 'instance');
    const configSelect = select('外观预设', 'config');
    const stripeSelect = select('条纹预设', 'stripe');
    const selected = () => field.current?.monsters.find(m => m.id === settings.current.selectedId);
    const patch = (data: Omit<Extract<BattlefieldCommand, { kind: 'patch' }>, 'kind' | 'monsterId'>) =>
      commandField({ kind: 'patch', monsterId: settings.current.selectedId, ...data });
    const commandField = (command: BattlefieldCommand) => context.communication.request(monsterBattlefieldCommand, command);
    const refresh = () => context.communication.request(monsterVisualCommand, { kind: 'refresh' });
    monsterSelect.addEventListener('change', () => void perform(async () => { settings.current.selectedId = monsterSelect.value; settings.markChanged(); render(); await refresh(); }));
    configSelect.addEventListener('change', () => void perform(() => patch({ configKey: configSelect.value })));
    stripeSelect.addEventListener('change', () => void perform(() => patch({ stripeKey: stripeSelect.value })));
    panel.content.append(button('添加同类怪物', 'add', async () => { await commandField({ kind: 'add', configKey: configSelect.value });
      settings.current.selectedId = field.require().monsters.at(-1)?.id ?? ''; settings.markChanged(); render(); await refresh(); }),
    button('移除当前怪物', 'remove', () => commandField({ kind: 'remove', monsterId: settings.current.selectedId })));
    const number = (label: string, id: string, min: number, max: number, step: number) => {
      const el = document.createElement('input'); el.type = 'number'; el.min = String(min); el.max = String(max); el.step = String(step); el.dataset.monsterControl = id;
      panel.content.append(createLabField(label, el)); return el;
    };
    const row = number('目标行', 'row', 0, 100, 1), column = number('目标列', 'column', 0, 5, 1), size = number('占用列数', 'size', 1, 6, 1);
    const centered = createLabSwitch('整行居中'); centered.input.dataset.monsterControl = 'centered'; panel.content.append(centered.row);
    panel.content.append(button('直接应用位置', 'position', () => patch({ row: Number(row.value), column: Number(column.value), size: Number(size.value), centered: centered.input.checked })));
    const movement = select('移动表现预设', 'movement');
    panel.content.append(button('移动到目标行列', 'move', async () => {
      if (settings.current.paused || context.scheduler.isPaused) throw new Error('请先恢复怪物表现播放。');
      await commandField({ kind: 'move', monsterId: settings.current.selectedId, row: Number(row.value), column: Number(column.value), presetKey: movement.value });
    }));
    const attack = select('攻击表现预设', 'attack');
    panel.content.append(button('播放攻击', 'attack', () => context.communication.request(monsterVisualCommand, { kind: 'attack', monsterId: settings.current.selectedId, presetKey: attack.value })),
      button('播放受击', 'hit', () => context.communication.request(monsterVisualCommand, { kind: 'hit', monsterId: settings.current.selectedId })));
    const death = select('死亡表现预设', 'death');
    panel.content.append(button('播放死亡', 'death', () => context.communication.request(monsterVisualCommand, { kind: 'death', monsterId: settings.current.selectedId, presetKey: death.value })),
      button('停止并恢复全部怪物', 'reset', () => context.communication.request(monsterVisualCommand, { kind: 'reset' })));
    const scale = number('怪物大小', 'scale', 1, 10000, 1), sceneScale = number('3D 场景倍率', 'scene-scale', .01, 100, .1);
    const height = number('高度 Y', 'height', -1000, 1000, .1), offsetX = number('水平偏移 X', 'offset-x', -1000, 1000, .1);
    const facing = select('精灵面向轴', 'facing'); fill(facing, [['+Z', '+Z'], ['-Z', '-Z']], '+Z');
    panel.content.append(button('应用当前实例显示参数', 'display', () => patch({ display: {
      scaleSize: Number(scale.value), scene3dScale: Number(sceneScale.value), scene3dHeight: Number(height.value), scene3dOffsetX: Number(offsetX.value),
      spriteFacingAxis: facing.value as MonsterDisplayOverrides['spriteFacingAxis'],
    } })), button('恢复该实例预设参数', 'restore-display', () => patch({ display: null })));
    const boxes = createLabSwitch('显示图层包围盒'); boxes.input.dataset.monsterControl = 'boxes';
    boxes.input.addEventListener('change', () => void perform(async () => { settings.current.boundingBoxes = boxes.input.checked; settings.markChanged(); await refresh(); }));
    const paused = createLabSwitch('暂停怪物表现（相机可继续操作）'); paused.input.dataset.monsterControl = 'paused';
    paused.input.addEventListener('change', () => { settings.current.paused = paused.input.checked; settings.markChanged(); });
    panel.content.append(boxes.row, paused.row, button('重新读取视觉预设', 'reload', async () => {
      status.textContent = '正在重新读取…'; await context.communication.request(monsterLibrariesReload, undefined); status.textContent = '视觉预设已更新。';
    }), status);
    const link = document.createElement('a'); link.href = '../../standalone/monster-3d-visual-lab/index.html'; link.textContent = '打开原独立 Lab 编辑正式配置'; panel.content.append(link);
    const render = () => {
      const resources = libraries.current, battlefield = field.current;
      if (!resources || !battlefield) return;
      if (!battlefield.monsters.some(m => m.id === settings.current.selectedId)) { settings.current.selectedId = battlefield.monsters[0]?.id ?? ''; settings.markChanged(); }
      fill(monsterSelect, battlefield.monsters.map((m, i) => [m.id, `${i + 1} · ${resources.configs[m.monsterConfigKey]?.name ?? m.monsterConfigKey}`]), settings.current.selectedId);
      const monster = selected();
      fill(configSelect, Object.entries(resources.configs).map(([key, value]) => [key, value.name]), monster?.monsterConfigKey ?? '');
      fill(stripeSelect, [['', '跟随外观预设'], ...Object.entries(resources.monsterStripes).map(([key, value]): [string, string] => [key, value.name])], monster?.monsterStripePresetKey ?? '');
      for (const [el, values] of [[movement, resources.movements], [attack, resources.attacks], [death, resources.deaths]] as const)
        fill(el, Object.entries(values).map(([key, value]) => [key, value.name]), el.value);
      controls.forEach(el => { el.disabled = !monster && !['add', 'reload', 'reset'].includes(el.dataset.monsterAction!); });
      column.max = String(battlefield.width - 1); size.max = String(battlefield.width);
      row.value = String(monster?.position.row ?? 0); column.value = String(monster?.position.column ?? 0); size.value = String(monster?.position.size ?? 1);
      centered.input.checked = monster?.position.isOccupyingFullRowCentered ?? true;
      const display = monster?.display ?? (monster ? resources.configs[monster.monsterConfigKey] : null);
      if (display) { scale.value = String(display.scaleSize); sceneScale.value = String(display.scene3dScale); height.value = String(display.scene3dHeight); offsetX.value = String(display.scene3dOffsetX); facing.value = display.spriteFacingAxis; }
      boxes.input.checked = settings.current.boundingBoxes; paused.input.checked = settings.current.paused;
      panel.root.dataset.monsterCount = String(battlefield.monsters.length);
    };
    context.communication.on(monsterBattlefieldChanged, () => { render(); status.textContent = `当前战场有 ${field.current?.monsters.length ?? 0} 个怪物。`; });
    context.communication.on(monsterLibrariesChanged, render);
    context.communication.on(monsterVisualActionChanged, event => {
      status.textContent = `${event.kind} · ${event.outcome} · ${event.monsterId}`;
      status.dataset.actionId = String(event.actionId); status.dataset.outcome = event.outcome;
    });
    let started = false;
    const registration = context.labState.registerReference({
      moduleId: 'monster-visual-debug', key: 'settings', version: 1, value: settings,
      inspect: (value): LabStateJsonValue => ({ ...value.current }),
      save: {
        serialize: value => ({ ...value.current }),
        validate(saved, version) {
          if (version !== 1 || !MONSTER_VISUAL_SETTINGS.type.validate(saved)) throw new Error('怪物视觉设置存档无效。');
          return { ...saved };
        },
        restore(value, saved) { Object.assign(value.current, saved); value.markChanged(); },
        async afterRestore() { if (started) { render(); await refresh(); } },
      },
    });
    return { start() { started = true; render(); status.textContent = '视觉已就绪；操作只影响当前测试会话。'; panel.root.dataset.monsterReady = 'true'; },
      dispose() { started = false; registration.unregister(); panel.root.remove(); } };
  },
};
