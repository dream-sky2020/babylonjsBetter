import type { LabModule, LabStateJsonValue } from '@/labs/kit';
import { MONSTER_BATTLEFIELD, MONSTER_VISUAL_LIBRARIES, MONSTER_VISUAL_SETTINGS } from '../monsterVisual.memory';
import { createMonsterPreviewBattlefield, validateMonsterBattlefield } from '../monsterBattlefield.model';
import { monsterBattlefieldCommand, monsterBattlefieldChanged } from '../monsterVisual.protocol';

export const monsterBattlefieldLabModule: LabModule = {
  id: 'monster-battlefield', dependencies: ['monster-visual-libraries'],
  events: [{ definition: monsterBattlefieldChanged, publishes: true }],
  setup(context) {
    const field = context.memory.acquire(MONSTER_BATTLEFIELD);
    const libraries = context.memory.acquire(MONSTER_VISUAL_LIBRARIES);
    const settings = context.memory.acquire(MONSTER_VISUAL_SETTINGS);
    let generation = 0, started = false;
    const notify = (kind: 'replace' | 'update' | 'move', monsterId?: string, presetKey?: string) =>
      context.communication.publish(monsterBattlefieldChanged, { generation: ++generation, kind, monsterId, presetKey });
    const checkReferences = (next: NonNullable<typeof field.current>) => {
      const resources = libraries.require();
      for (const monster of next.monsters) {
        if (!resources.configs[monster.monsterConfigKey]) throw new Error(`怪物显示配置不存在：${monster.monsterConfigKey}`);
        if (monster.monsterStripePresetKey && !resources.monsterStripes[monster.monsterStripePresetKey]) throw new Error(`怪物条纹预设不存在：${monster.monsterStripePresetKey}`);
      }
    };
    const registration = context.labState.registerReference({
      moduleId: 'monster-battlefield', key: 'battlefield', version: 1, value: field,
      inspect: (value): LabStateJsonValue => value.current ? { id: value.current.id, monsterCount: value.current.monsters.length } : { loaded: false },
      save: {
        serialize: value => structuredClone(value.current) as unknown as LabStateJsonValue,
        validate(saved, version) {
          if (version !== 1) throw new Error('不支持的怪物战场存档版本。');
          const next = saved === null ? null : validateMonsterBattlefield(saved);
          if (next && started) checkReferences(next);
          return structuredClone(next) as unknown as LabStateJsonValue;
        },
        restore(value, saved) {
          const next = saved === null ? null : validateMonsterBattlefield(structuredClone(saved));
          if (next && started) checkReferences(next);
          value.replace(next);
        },
        async afterRestore() { if (started) { if (!field.current) field.replace(createMonsterPreviewBattlefield(Object.keys(libraries.require().configs)[0])); await notify('replace'); } },
      },
    });
    context.communication.handle(monsterBattlefieldCommand, async command => {
      if (command.kind === 'move' && (settings.current.paused || context.scheduler.isPaused)) throw new Error('请先恢复怪物表现播放。');
      const next = command.kind === 'replace' ? structuredClone(command.battlefield) : structuredClone(field.require());
      if (command.kind === 'add') {
        const base = createMonsterPreviewBattlefield(command.configKey).monsters[0];
        base.id = crypto.randomUUID(); base.position.row = next.monsters.length;
        next.monsters.push(base);
      } else if (command.kind === 'remove') {
        if (!next.monsters.some(m => m.id === command.monsterId)) throw new Error('怪物实例不存在。');
        next.monsters = next.monsters.filter(m => m.id !== command.monsterId);
      } else if (command.kind === 'patch' || command.kind === 'move') {
        const monster = next.monsters.find(m => m.id === command.monsterId);
        if (!monster) throw new Error('怪物实例不存在。');
        if (command.kind === 'move' && !libraries.require().movements[command.presetKey]) throw new Error('移动预设不存在。');
        if (command.row !== undefined) monster.position.row = command.row;
        if (command.column !== undefined) monster.position.column = command.column;
        if (command.kind === 'patch') {
          if (command.size !== undefined) monster.position.size = command.size;
          if (command.centered !== undefined) monster.position.isOccupyingFullRowCentered = command.centered;
          if (command.configKey !== undefined) { monster.monsterConfigKey = command.configKey; monster.typeId = command.configKey; delete monster.display; }
          if (command.stripeKey !== undefined) monster.monsterStripePresetKey = command.stripeKey;
          if (command.display === null) delete monster.display;
          else if (command.display) monster.display = command.display;
        }
      }
      validateMonsterBattlefield(next); checkReferences(next);
      field.replace(next); registration.markChanged();
      const report = await notify(command.kind === 'replace' ? 'replace' : command.kind === 'move' ? 'move' : 'update',
        'monsterId' in command ? command.monsterId : undefined, command.kind === 'move' ? command.presetKey : undefined);
      if (report.failed.length) context.ui.setStatus('战场已更新，但视觉观察者失败；请重置预览。', true);
    });
    return {
      async start() {
        if (!field.current) field.replace(createMonsterPreviewBattlefield(Object.keys(libraries.require().configs)[0]));
        checkReferences(field.require()); started = true; registration.markChanged(); await notify('replace');
      },
      dispose() { started = false; field.replace(null); registration.unregister(); },
    };
  },
};
