import { create } from 'zustand';
import type { UnitConfig, SkillData, StatusConfig, DiceConfig, DiceEffectConfig, SkillEffectConfig } from './types.ts';

interface CombatState {
  leftUnits: UnitConfig[];
  rightUnits: UnitConfig[];
  selectedLeftUnitId?: string;
  selectedRightUnitId?: string;
  logs: string[];
  
  // Actions
  addUnit: (side: 'left' | 'right', unit: UnitConfig) => void;
  removeUnit: (side: 'left' | 'right', unitId: string) => void;
  updateUnit: (side: 'left' | 'right', unitId: string, updates: Partial<UnitConfig>) => void;
  selectUnit: (side: 'left' | 'right', unitId: string) => void;
  addLog: (msg: string) => void;
  clearLogs: () => void;
  setUnits: (side: 'left' | 'right', units: UnitConfig[]) => void;
  getUnit: (unitId: string) => UnitConfig | undefined;

  // Deep Update Actions
  updateStatus: (side: 'left' | 'right', unitId: string, index: number, updates: Partial<StatusConfig>) => void;
  addStatus: (side: 'left' | 'right', unitId: string) => void;
  removeStatus: (side: 'left' | 'right', unitId: string, index: number) => void;
  
  updateSkill: (side: 'left' | 'right', unitId: string, skillId: string, updates: Partial<SkillData>) => void;
  addSkill: (side: 'left' | 'right', unitId: string) => void;
  removeSkill: (side: 'left' | 'right', unitId: string, skillId: string) => void;
  
  updateDice: (side: 'left' | 'right', unitId: string, skillId: string, diceIndex: number, updates: Partial<DiceConfig>) => void;
  addDice: (side: 'left' | 'right', unitId: string, skillId: string) => void;
  removeDice: (side: 'left' | 'right', unitId: string, skillId: string, diceIndex: number) => void;
  
  updateDiceEffect: (side: 'left' | 'right', unitId: string, skillId: string, diceIndex: number, effectIndex: number, updates: Partial<DiceEffectConfig>) => void;
  addDiceEffect: (side: 'left' | 'right', unitId: string, skillId: string, diceIndex: number) => void;
  removeDiceEffect: (side: 'left' | 'right', unitId: string, skillId: string, diceIndex: number, effectIndex: number) => void;
  
  updateSkillEffect: (side: 'left' | 'right', unitId: string, skillId: string, effectIndex: number, updates: Partial<SkillEffectConfig>) => void;
  addSkillEffect: (side: 'left' | 'right', unitId: string, skillId: string) => void;
  removeSkillEffect: (side: 'left' | 'right', unitId: string, skillId: string, effectIndex: number) => void;
}

export const useCombatStore = create<CombatState>((set, get) => ({
  leftUnits: [],
  rightUnits: [],
  logs: [],
  
  addUnit: (side, unit) => set((state) => {
    const key = side === 'left' ? 'leftUnits' : 'rightUnits';
    return { [key]: [...state[key], unit] };
  }),
  
  removeUnit: (side, unitId) => set((state) => {
    const key = side === 'left' ? 'leftUnits' : 'rightUnits';
    return { [key]: state[key].filter(u => u.id !== unitId) };
  }),
  
  updateUnit: (side, unitId, updates) => set((state) => {
    const key = side === 'left' ? 'leftUnits' : 'rightUnits';
    return { [key]: state[key].map(u => u.id === unitId ? { ...u, ...updates } : u) };
  }),
  
  selectUnit: (side, unitId) => set(() => {
    const key = side === 'left' ? 'selectedLeftUnitId' : 'selectedRightUnitId';
    return { [key]: unitId };
  }),
  
  addLog: (msg) => set((state) => ({ logs: [...state.logs, msg] })),
  clearLogs: () => set({ logs: [] }),
  setUnits: (side, units) => set(() => ({ [side === 'left' ? 'leftUnits' : 'rightUnits']: units })),
  getUnit: (unitId) => {
    const state = get();
    if (unitId === 'A' || unitId === 'left') return state.leftUnits.find(u => u.id === state.selectedLeftUnitId);
    if (unitId === 'B' || unitId === 'right') return state.rightUnits.find(u => u.id === state.selectedRightUnitId);
    return state.leftUnits.find(u => u.id === unitId) || state.rightUnits.find(u => u.id === unitId);
  },

  // Deep Update Implementations
  updateStatus: (side, unitId, index, updates) => set((state) => {
    const key = side === 'left' ? 'leftUnits' : 'rightUnits';
    return {
      [key]: state[key].map(u => u.id === unitId ? {
        ...u,
        status: u.status.map((s, i) => i === index ? { ...s, ...updates } : s)
      } : u)
    };
  }),
  addStatus: (side, unitId) => set((state) => {
    const key = side === 'left' ? 'leftUnits' : 'rightUnits';
    return {
      [key]: state[key].map(u => u.id === unitId ? {
        ...u,
        status: [...u.status, { type: 'bleed', stack: 1, power: 1 }]
      } : u)
    };
  }),
  removeStatus: (side, unitId, index) => set((state) => {
    const key = side === 'left' ? 'leftUnits' : 'rightUnits';
    return {
      [key]: state[key].map(u => u.id === unitId ? {
        ...u,
        status: u.status.filter((_, i) => i !== index)
      } : u)
    };
  }),

  updateSkill: (side, unitId, skillId, updates) => set((state) => {
    const key = side === 'left' ? 'leftUnits' : 'rightUnits';
    return {
      [key]: state[key].map(u => u.id === unitId ? {
        ...u,
        skills: u.skills.map(s => s.skillId === skillId ? { ...s, ...updates } : s)
      } : u)
    };
  }),
  addSkill: (side, unitId) => set((state) => {
    const key = side === 'left' ? 'leftUnits' : 'rightUnits';
    const skillId = `S${Date.now()}`;
    return {
      [key]: state[key].map(u => u.id === unitId ? {
        ...u,
        skills: [...u.skills, { skillId, skillName: '新技能', tags: ['active'], dice: [], skillEffects: [] }],
        activeSkillId: skillId
      } : u)
    };
  }),
  removeSkill: (side, unitId, skillId) => set((state) => {
    const key = side === 'left' ? 'leftUnits' : 'rightUnits';
    return {
      [key]: state[key].map(u => u.id === unitId ? {
        ...u,
        skills: u.skills.filter(s => s.skillId !== skillId),
        activeSkillId: u.activeSkillId === skillId ? undefined : u.activeSkillId
      } : u)
    };
  }),

  updateDice: (side, unitId, skillId, diceIndex, updates) => set((state) => {
    const key = side === 'left' ? 'leftUnits' : 'rightUnits';
    return {
      [key]: state[key].map(u => u.id === unitId ? {
        ...u,
        skills: u.skills.map(s => s.skillId === skillId ? {
          ...s,
          dice: s.dice.map((d, i) => i === diceIndex ? { ...d, ...updates } : d)
        } : s)
      } : u)
    };
  }),
  addDice: (side, unitId, skillId) => set((state) => {
    const key = side === 'left' ? 'leftUnits' : 'rightUnits';
    return {
      [key]: state[key].map(u => u.id === unitId ? {
        ...u,
        skills: u.skills.map(s => s.skillId === skillId ? {
          ...s,
          dice: [...s.dice, { min: 1, max: 6, tags: [], effects: [] }]
        } : s)
      } : u)
    };
  }),
  removeDice: (side, unitId, skillId, diceIndex) => set((state) => {
    const key = side === 'left' ? 'leftUnits' : 'rightUnits';
    return {
      [key]: state[key].map(u => u.id === unitId ? {
        ...u,
        skills: u.skills.map(s => s.skillId === skillId ? {
          ...s,
          dice: s.dice.filter((_, i) => i !== diceIndex)
        } : s)
      } : u)
    };
  }),

  updateDiceEffect: (side, unitId, skillId, diceIndex, effectIndex, updates) => set((state) => {
    const key = side === 'left' ? 'leftUnits' : 'rightUnits';
    return {
      [key]: state[key].map(u => u.id === unitId ? {
        ...u,
        skills: u.skills.map(s => s.skillId === skillId ? {
          ...s,
          dice: s.dice.map((d, i) => i === diceIndex ? {
            ...d,
            effects: (d.effects || []).map((e, ei) => ei === effectIndex ? { ...e, ...updates } : e)
          } : d)
        } : s)
      } : u)
    };
  }),
  addDiceEffect: (side, unitId, skillId, diceIndex) => set((state) => {
    const key = side === 'left' ? 'leftUnits' : 'rightUnits';
    return {
      [key]: state[key].map(u => u.id === unitId ? {
        ...u,
        skills: u.skills.map(s => s.skillId === skillId ? {
          ...s,
          dice: s.dice.map((d, i) => i === diceIndex ? {
            ...d,
            effects: [...(d.effects || []), { type: 'dmg', value: 0, tags: [] }]
          } : d)
        } : s)
      } : u)
    };
  }),
  removeDiceEffect: (side, unitId, skillId, diceIndex, effectIndex) => set((state) => {
    const key = side === 'left' ? 'leftUnits' : 'rightUnits';
    return {
      [key]: state[key].map(u => u.id === unitId ? {
        ...u,
        skills: u.skills.map(s => s.skillId === skillId ? {
          ...s,
          dice: s.dice.map((d, i) => i === diceIndex ? {
            ...d,
            effects: (d.effects || []).filter((_, ei) => ei !== effectIndex)
          } : d)
        } : s)
      } : u)
    };
  }),

  updateSkillEffect: (side, unitId, skillId, effectIndex, updates) => set((state) => {
    const key = side === 'left' ? 'leftUnits' : 'rightUnits';
    return {
      [key]: state[key].map(u => u.id === unitId ? {
        ...u,
        skills: u.skills.map(s => s.skillId === skillId ? {
          ...s,
          skillEffects: s.skillEffects.map((e, i) => i === effectIndex ? { ...e, ...updates } : e)
        } : s)
      } : u)
    };
  }),
  addSkillEffect: (side, unitId, skillId) => set((state) => {
    const key = side === 'left' ? 'leftUnits' : 'rightUnits';
    return {
      [key]: state[key].map(u => u.id === unitId ? {
        ...u,
        skills: u.skills.map(s => s.skillId === skillId ? {
          ...s,
          skillEffects: [...s.skillEffects, { timing: 'onHit', type: 'dmg', value: 0, tags: [] }]
        } : s)
      } : u)
    };
  }),
  removeSkillEffect: (side, unitId, skillId, effectIndex) => set((state) => {
    const key = side === 'left' ? 'leftUnits' : 'rightUnits';
    return {
      [key]: state[key].map(u => u.id === unitId ? {
        ...u,
        skills: u.skills.map(s => s.skillId === skillId ? {
          ...s,
          skillEffects: s.skillEffects.filter((_, i) => i !== effectIndex)
        } : s)
      } : u)
    };
  }),
}));
