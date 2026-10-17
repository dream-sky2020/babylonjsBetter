import { create } from 'zustand';
import { createBattle, createSkill, createUnit } from './data.ts';
import { endPhase, resolveAction, restartBattle } from './engine.ts';
import { chooseAutoAction } from './autoAction.ts';
import type { Action, Battle, ForcedRoll, Side, Skill, Unit } from './types.ts';
import { applyPreparation, type Preparation } from './preparation.ts';
type Store = { battle: Battle; selected: Record<Side, string | undefined>; act: (action: Action) => void; end: () => void; restart: () => void; reset: () => void; clear: () => void; select: (side: Side, id: string) => void; setActor: (id: string) => void; addUnit: (side: Side) => void; removeUnit: (side: Side, id: string) => void; patchUnit: (side: Side, id: string, patch: Partial<Unit>) => void; addSkill: (side: Side, id: string) => void; removeSkill: (side: Side, id: string, skill: string) => void; patchSkill: (side: Side, id: string, skill: string, patch: Partial<Skill>) => void };
type Controls = { forced: ForcedRoll; targetId?: string; setForced: (forced: ForcedRoll) => void; setTarget: (id: string) => void; autoStep: () => void };
type LoadoutControls = { configurePreparation: (side: Side, id: string, draft: Preparation) => boolean };
export const usePressStore = create<Store & Controls & LoadoutControls>((set, get) => ({
  configurePreparation: (side, id, draft) => {
    const state = get(); const source = state.battle.teams[side].find(unit => unit.id === id);
    if (!source) return false;
    const unit = structuredClone(source); if (!applyPreparation(unit, draft)) return false;
    set({ battle: { ...state.battle, teams: { ...state.battle.teams, [side]: state.battle.teams[side].map(item => item.id === id ? unit : item) }, logs: [...state.battle.logs, `[配置整备] ${unit.name} 的装备与技能槽已更新（配置编辑，不扣行动点）。`] } });
    return true;
  },
  forced: 'random', targetId: 'R1',
  setForced: forced => set({ forced }), setTarget: targetId => set({ targetId }),
  autoStep: () => set(state => {
    const choice = chooseAutoAction(state.battle);
    if (!choice) return {};
    const prepared = structuredClone(state.battle);
    const actor = prepared.teams[prepared.side].find(unit => unit.id === choice.action.actorId)!;
    if (choice.action.skillId) actor.skillId = choice.action.skillId;
    const skill = actor.skills.find(item => item.id === choice.action.skillId);
    prepared.logs.push(`[自动一步] ${actor.name}：${skill?.name ?? '空过'}，${choice.reason}。`);
    return { battle: resolveAction(prepared, { ...choice.action, forced: state.forced }), targetId: choice.action.targetId ?? state.targetId };
  }),
  battle: createBattle(), selected: { left: 'L1', right: 'R1' },
  act: action => set(state => ({ battle: resolveAction(state.battle, action) })),
  end: () => set(state => ({ battle: endPhase(state.battle) })),
  restart: () => set(state => ({ battle: restartBattle(state.battle) })),
  reset: () => set({ battle: createBattle(), selected: { left: 'L1', right: 'R1' }, forced: 'random', targetId: 'R1' }),
  clear: () => set(state => ({ battle: { ...state.battle, logs: [], last: undefined } })),
  select: (side, id) => set(state => ({ selected: { ...state.selected, [side]: id } })),
  setActor: id => set(state => state.battle.teams[state.battle.side].some(unit => unit.id === id && unit.hp > 0) ? { battle: { ...state.battle, actorId: id } } : {}),
  addUnit: side => {
    const id = crypto.randomUUID(); const state = get();
    set({ battle: { ...state.battle, teams: { ...state.battle.teams, [side]: [...state.battle.teams[side], createUnit(id, `新单位 ${state.battle.teams[side].length + 1}`)] } }, selected: { ...state.selected, [side]: id } });
  },
  removeUnit: (side, id) => set(state => {
    const team = state.battle.teams[side]; const index = team.findIndex(u => u.id === id);
    const next = team.filter(u => u.id !== id);
    return { battle: { ...state.battle, teams: { ...state.battle.teams, [side]: next }, actorId: state.battle.actorId === id ? next.find(u => u.hp > 0)?.id : state.battle.actorId }, selected: { ...state.selected, [side]: state.selected[side] === id ? (team[index + 1] ?? team[index - 1])?.id : state.selected[side] } };
  }),
  patchUnit: (side, id, patch) => set(state => ({ battle: { ...state.battle, teams: { ...state.battle.teams, [side]: state.battle.teams[side].map(u => u.id === id ? { ...u, ...patch } : u) } } })),
  addSkill: (side, id) => { const unit = get().battle.teams[side].find(u => u.id === id); if (!unit) return; const skill = createSkill(); get().patchUnit(side, id, { skills: [...unit.skills, skill], skillId: skill.id }); },
  removeSkill: (side, id, skillId) => { const unit = get().battle.teams[side].find(u => u.id === id); if (!unit) return; const index = unit.skills.findIndex(s => s.id === skillId); get().patchUnit(side, id, { skills: unit.skills.filter(s => s.id !== skillId), skillId: unit.skillId === skillId ? (unit.skills[index + 1] ?? unit.skills[index - 1])?.id : unit.skillId }); },
  patchSkill: (side, id, skillId, patch) => { const unit = get().battle.teams[side].find(u => u.id === id); if (unit) get().patchUnit(side, id, { skills: unit.skills.map(s => s.id === skillId ? { ...s, ...patch } : s) }); },
}));
