export type CombatFaction = 'ally' | 'enemy' | 'neutral';
export type TurnPhase = 'ally' | 'nonAlly';
/** One round contains the ally phase followed by the non-ally phase. */
export type TurnPhaseState = { round: number; phase: TurnPhase };

export function phaseForFaction(faction: CombatFaction): TurnPhase {
  switch (faction) {
    case 'ally': return 'ally';
    case 'enemy':
    case 'neutral': return 'nonAlly';
    default: throw new Error('未知角色阵营。');
  }
}

export function createTurnPhase(): TurnPhaseState {
  return { round: 1, phase: 'ally' };
}

/** Called explicitly after the current side finishes; does not schedule units or tick cooldowns. */
export function advanceTurnPhase(state: TurnPhaseState): TurnPhaseState {
  if (!Number.isSafeInteger(state.round) || state.round < 1) throw new Error('战斗轮数无效。');
  if (state.phase === 'ally') return { round: state.round, phase: 'nonAlly' };
  if (state.phase !== 'nonAlly' || !Number.isSafeInteger(state.round + 1)) throw new Error('战斗阶段无效。');
  return { round: state.round + 1, phase: 'ally' };
}
