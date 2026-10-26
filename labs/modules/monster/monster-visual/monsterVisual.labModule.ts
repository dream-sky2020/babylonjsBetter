import { Color3, Vector3 } from '@babylonjs/core';
import { MONSTER_RENDER_ORDER, MonsterVisualManager } from '@/core/monster';
import type { LabModule } from '@/labs/kit';
import type { MonsterDisplayConfig, MonsterVisualResources, VisualBattlefield } from '@/core/monster';
import { MONSTER_BATTLEFIELD, MONSTER_VISUAL_LIBRARIES, MONSTER_VISUAL_SETTINGS } from '../monsterVisual.memory';
import { monsterBattlefieldChanged, monsterLibrariesChanged, monsterVisualActionChanged, monsterVisualCommand,
  type MonsterVisualAction } from '../monsterVisual.protocol';

/** One manager and one presentation task per Host. No Engine, camera or simulation is created here. */
export const monsterVisualLabModule: LabModule = {
  id: 'monster-visual', dependencies: ['monster-visual-libraries', 'monster-battlefield'],
  events: [{ definition: monsterVisualActionChanged, publishes: true }],
  setup(context) {
    const libraries = context.memory.acquire(MONSTER_VISUAL_LIBRARIES);
    const field = context.memory.acquire(MONSTER_BATTLEFIELD);
    const settings = context.memory.acquire(MONSTER_VISUAL_SETTINGS);
    const manager = new MonsterVisualManager(context.scene);
    manager.setHelpersVisible(false);
    const actions = new Map<string, Omit<MonsterVisualAction, 'outcome'>>();
    const displayCache = new Map<string, { source: MonsterDisplayConfig; signature: string; config: MonsterDisplayConfig }>();
    let sequence = 0, lastGeneration = 0, started = false, disposed = false;
    const emit = (action: Omit<MonsterVisualAction, 'outcome'>, outcome: MonsterVisualAction['outcome']) => {
      void context.communication.publish(monsterVisualActionChanged, { ...action, outcome });
    };
    const cancel = (monsterId?: string) => {
      for (const [id, action] of actions) {
        if (monsterId && monsterId !== id) continue;
        actions.delete(id); emit(action, 'cancelled');
      }
      const ids = monsterId ? [monsterId] : field.current?.monsters.map(m => m.id) ?? [];
      for (const id of ids) {
        manager.stopMonsterMovement(id); manager.stopMonsterAttack(id); manager.stopMonsterHit(id); manager.stopMonsterDeath(id);
      }
    };
    const begin = (monsterId: string, kind: MonsterVisualAction['kind'], play: (done: () => void) => boolean) => {
      cancel(monsterId);
      if (kind !== 'move') sync();
      const action = { actionId: ++sequence, monsterId, kind };
      actions.set(monsterId, action);
      const accepted = play(() => {
        if (disposed || actions.get(monsterId) !== action) return;
        actions.delete(monsterId); emit(action, 'completed');
      });
      if (!accepted) { actions.delete(monsterId); throw new Error('怪物视觉尚未就绪，或所选表现预设无效。'); }
      emit(action, 'started');
    };
    const applySettings = () => {
      for (const monster of field.current?.monsters ?? []) for (const layer of MONSTER_RENDER_ORDER) {
        const mesh = manager.getMonsterLayerMesh(monster.id, layer);
        if (mesh) mesh.showBoundingBox = settings.current.boundingBoxes;
      }
    };
    const sync = () => {
      if (!started || disposed || !field.current || !libraries.current) return;
      const resources: MonsterVisualResources = { configs: { ...libraries.current.configs }, monsterStripes: libraries.current.monsterStripes, stripes: libraries.current.stripes };
      const battlefield: VisualBattlefield = { ...field.current, monsters: field.current.monsters.map(monster => {
        if (!monster.display) return monster;
        const config = resources.configs[monster.monsterConfigKey];
        if (!config) return monster;
        const key = `@instance:${monster.id}`;
        const signature = JSON.stringify(monster.display), cached = displayCache.get(monster.id);
        const display = cached?.source === config && cached.signature === signature ? cached.config : { ...config, ...monster.display, id: key };
        displayCache.set(monster.id, { source: config, signature, config: display });
        resources.configs[key] = display;
        return { ...monster, monsterConfigKey: key };
      }) };
      manager.sync(battlefield, resources, settings.current.selectedId);
      const ids = new Set(field.current.monsters.map(m => m.id));
      for (const id of displayCache.keys()) if (!ids.has(id)) displayCache.delete(id);
      applySettings();
    };
    context.communication.on(monsterBattlefieldChanged, event => {
      if (!started || event.generation <= lastGeneration) return;
      lastGeneration = event.generation;
      if (event.kind === 'move' && event.monsterId && event.presetKey) {
        const battlefield = field.require(), monster = battlefield.monsters.find(m => m.id === event.monsterId);
        const preset = libraries.require().movements[event.presetKey];
        if (monster && preset) begin(monster.id, 'move', done => manager.moveMonster(battlefield, monster, preset, done));
      } else {
        cancel(event.monsterId);
        // Removed monsters may no longer be in shared data; clear also releases their outstanding effects.
        if (event.kind === 'replace') manager.clear();
      }
      sync();
    });
    context.communication.on(monsterLibrariesChanged, () => { if (started) { cancel(); manager.clear(); sync(); } });
    context.communication.handle(monsterVisualCommand, command => {
      if (!started) throw new Error('怪物视觉模块尚未启动。');
      if (command.kind === 'refresh') { applySettings(); return; }
      if (command.kind === 'reset') { cancel(command.monsterId); sync(); return; }
      if (context.scheduler.isPaused || settings.current.paused) throw new Error('请先恢复怪物表现播放。');
      if (!field.require().monsters.some(m => m.id === command.monsterId)) throw new Error('怪物实例不存在。');
      if (command.kind === 'attack') {
        const preset = libraries.require().attacks[command.presetKey];
        if (!preset) throw new Error('攻击预设不存在。');
        begin(command.monsterId, 'attack', done => manager.playMonsterAttack(command.monsterId, preset, new Vector3(0, 0, 1), done));
      } else if (command.kind === 'death') {
        const preset = libraries.require().deaths[command.presetKey];
        if (!preset) throw new Error('死亡预设不存在。');
        begin(command.monsterId, 'death', done => manager.playMonsterDeath(command.monsterId, preset, done));
      } else {
        begin(command.monsterId, 'hit', done => manager.playMonsterHit(command.monsterId,
          { durationMs: 360, shakeAmplitude: .18, shakeFrequency: 18, overlayStrength: .7, color: Color3.FromHexString('#ff3b30') }, done));
      }
    });
    const stop = context.scheduler.register({ id: 'monster-visual-update', phase: 'presentation', order: 200,
      description: '推进怪物条纹、移动、攻击、受击及死亡表现',
      enabled: () => started && !settings.current.paused && !context.scheduler.isPaused,
      run: dt => manager.update(dt),
    });
    return { start() { started = true; sync(); }, dispose() { cancel(); disposed = true; started = false; stop(); displayCache.clear(); manager.dispose(); } };
  },
};
