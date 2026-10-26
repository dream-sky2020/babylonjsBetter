import type { LabModule, LabStateJsonValue } from '@/labs/kit';
import { MONSTER_BATTLEFIELD, MONSTER_VISUAL_LIBRARIES, MONSTER_SELECTION, type MonsterVisualLibraries } from '../monsterVisual.memory';
import { createMonsterPreviewBattlefield, validateMonsterBattlefield, type MonsterBattlefield } from '../monsterBattlefield.model';
import { monsterBattlefieldCommand, monsterBattlefieldChanged, monsterLibrariesValidate, monsterLibrariesChanged, monsterSelectionCommand, monsterSelectionChanged } from '../monsterVisual.protocol';
import { createMonsterPanel, fillMonsterSelect } from '../monsterModuleUi';
import { persistMonsterState } from '../monsterModuleState';
import { MONSTER_BATTLEFIELD_SERVICE } from './monsterBattlefield.service';

export const monsterBattlefieldLabModule: LabModule = {
  id: 'monster-battlefield', dependencies: ['monster-visual-libraries'],
  events: [{ definition: monsterBattlefieldChanged, publishes: true }, { definition: monsterSelectionChanged, publishes: true }],
  setup(context) {
    const field = context.memory.acquire(MONSTER_BATTLEFIELD), libraries = context.memory.acquire(MONSTER_VISUAL_LIBRARIES), selection = context.memory.acquire(MONSTER_SELECTION);
    const panel = createMonsterPanel(context, 'monster-battlefield', '怪物实例与布局');
    let generation = 0, started = false;
    const checkReferences = (next: MonsterBattlefield, resources: MonsterVisualLibraries = libraries.require()) => {
      for (const monster of next.monsters) {
        if (!resources.configs[monster.monsterConfigKey]) throw new Error('怪物显示配置不存在：' + monster.monsterConfigKey);
        if (monster.monsterStripePresetKey && !resources.monsterStripes[monster.monsterStripePresetKey]) throw new Error('怪物条纹预设不存在：' + monster.monsterStripePresetKey);
      }
    };
    context.communication.handle(monsterLibrariesValidate, resources => { if (field.current) checkReferences(field.current, resources); });
    const publishSelection = () => context.communication.publish(monsterSelectionChanged, { ...selection.current });
    const repairSelection = () => {
      if (field.current?.monsters.some(monster => monster.id === selection.current.selectedId)) return;
      selection.replace({ selectedId: field.current?.monsters[0]?.id ?? '' }); selectionState.changed();
    };
    const notify = async (kind: 'replace' | 'update' | 'move', monsterId?: string) => {
      const report = await context.communication.publish(monsterBattlefieldChanged, { generation: ++generation, kind, monsterId });
      if (report.failed.length) throw new Error('战场已提交，但表现更新失败；请重置预览。');
      render();
    };
    const registration = context.labState.registerReference({ moduleId: 'monster-battlefield', key: 'battlefield', version: 1, value: field,
      inspect: (value): LabStateJsonValue => value.current ? { id: value.current.id, monsterCount: value.current.monsters.length } : { loaded: false },
      save: {
        serialize: value => structuredClone(value.current) as unknown as LabStateJsonValue,
        validate(saved, version) { if (version !== 1) throw new Error('不支持的怪物战场存档版本。'); const next = saved === null ? null : validateMonsterBattlefield(saved); if (next && started) checkReferences(next); return structuredClone(next) as unknown as LabStateJsonValue; },
        restore(value, saved) { value.replace(saved === null ? null : validateMonsterBattlefield(structuredClone(saved))); },
        async afterRestore() { if (started) { if (!field.current) field.replace(createMonsterPreviewBattlefield(Object.keys(libraries.require().configs)[0])); repairSelection(); await notify('replace'); } },
      },
    });
    const selectionState = persistMonsterState(context, 'monster-battlefield', 'selection', MONSTER_SELECTION, selection,
      async () => { if (started) { repairSelection(); render(); await publishSelection(); } },
      [{ moduleId: 'monster-visual-debug', key: 'settings', select: saved => ({ selectedId: (saved as { selectedId?: unknown })?.selectedId }) }]);
    const commit = async (next: MonsterBattlefield, kind: 'replace' | 'update' | 'move', monsterId?: string) => {
      validateMonsterBattlefield(next); checkReferences(next); field.replace(next); registration.markChanged();
      repairSelection(); await notify(kind, monsterId);
    };
    context.services.set(MONSTER_BATTLEFIELD_SERVICE, { commitMove: (next, id) => commit(next, 'move', id) });
    context.communication.handle(monsterSelectionCommand, async command => {
      if (command.selectedId && !field.require().monsters.some(monster => monster.id === command.selectedId)) throw new Error('怪物实例不存在。');
      selection.replace({ selectedId: command.selectedId }); selectionState.changed(); render(); await publishSelection();
    });
    context.communication.handle(monsterBattlefieldCommand, async command => {
      const next = command.kind === 'replace' ? structuredClone(command.battlefield) : structuredClone(field.require());
      let changedId = 'monsterId' in command ? command.monsterId : undefined;
      if (command.kind === 'add') {
        const monster = createMonsterPreviewBattlefield(command.configKey).monsters[0];
        const occupied = new Set(next.monsters.map(item => item.position.row)); let row = 0; while (occupied.has(row)) row++;
        monster.id = crypto.randomUUID(); monster.position.row = row; changedId = monster.id; next.monsters.push(monster);
      } else if (command.kind === 'remove') {
        if (!next.monsters.some(item => item.id === command.monsterId)) throw new Error('怪物实例不存在。');
        next.monsters = next.monsters.filter(item => item.id !== command.monsterId);
      } else if (command.kind === 'patch') {
        const monster = next.monsters.find(item => item.id === command.monsterId); if (!monster) throw new Error('怪物实例不存在。');
        if (command.row !== undefined) monster.position.row = command.row;
        if (command.column !== undefined) monster.position.column = command.column;
        if (command.size !== undefined) monster.position.size = command.size;
        if (command.centered !== undefined) monster.position.isOccupyingFullRowCentered = command.centered;
        if (command.configKey !== undefined) { monster.monsterConfigKey = command.configKey; monster.typeId = command.configKey; delete monster.display; }
        if (command.stripeKey !== undefined) monster.monsterStripePresetKey = command.stripeKey;
        if (command.display === null) delete monster.display; else if (command.display) monster.display = command.display;
      }
      await commit(next, command.kind === 'replace' ? 'replace' : 'update', changedId);
    });
    const instance = panel.select('当前怪物', 'instance'), spawn = panel.select('新增怪物外观', 'spawn-config');
    instance.addEventListener('change', () => void panel.run(() => context.communication.request(monsterSelectionCommand, { selectedId: instance.value })));
    panel.button('添加怪物', 'add', async () => {
      await context.communication.request(monsterBattlefieldCommand, { kind: 'add', configKey: spawn.value });
      await context.communication.request(monsterSelectionCommand, { selectedId: field.require().monsters.at(-1)!.id });
    });
    const remove = panel.button('移除当前怪物', 'remove', () => context.communication.request(monsterBattlefieldCommand, { kind: 'remove', monsterId: selection.current.selectedId }));
    const row = panel.number('所在行', 'row', 0, 100, 1), column = panel.number('所在列', 'column', 0, 31, 1), size = panel.number('占用列数', 'size', 1, 32, 1);
    const centered = panel.toggle('整行居中', 'centered');
    const position = panel.button('直接应用位置', 'position', () => context.communication.request(monsterBattlefieldCommand, { kind: 'patch', monsterId: selection.current.selectedId,
      row: Number(row.value), column: Number(column.value), size: Number(size.value), centered: centered.checked }));
    const render = () => {
      if (!libraries.current || !field.current) return;
      const monsters = field.current.monsters, selected = monsters.find(item => item.id === selection.current.selectedId);
      fillMonsterSelect(instance, monsters.map((item, index) => [item.id, (index + 1) + ' · ' + (libraries.current!.configs[item.monsterConfigKey]?.name ?? item.monsterConfigKey)]), selection.current.selectedId);
      fillMonsterSelect(spawn, Object.entries(libraries.current.configs).map(([key, item]) => [key, item.name]), spawn.value || selected?.monsterConfigKey || '');
      row.value = String(selected?.position.row ?? 0); column.value = String(selected?.position.column ?? 0); size.value = String(selected?.position.size ?? 1);
      column.max = String(field.current.width - 1); size.max = String(field.current.width); centered.checked = selected?.position.isOccupyingFullRowCentered ?? true;
      remove.disabled = position.disabled = !selected; panel.root.dataset.monsterCount = String(monsters.length);
      panel.status.textContent = '当前战场有 ' + monsters.length + ' 个怪物。';
    };
    context.communication.on(monsterLibrariesChanged, render);
    return { async start() {
      if (!field.current) field.replace(createMonsterPreviewBattlefield(Object.keys(libraries.require().configs)[0]));
      checkReferences(field.require()); started = true; repairSelection(); render(); await notify('replace');
    }, dispose() { started = false; field.replace(null); registration.unregister(); selectionState.dispose(); panel.root.remove(); } };
  },
};
