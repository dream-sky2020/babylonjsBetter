import { combatStats } from './preparation.ts';
import { sideName, type Battle } from './types.ts';
import type { actionContext } from './actionContext.ts';

export function BattlefieldRoster({ battle, context, editing, select }: { battle: Battle; context: ReturnType<typeof actionContext>; editing: boolean; select: (id: string) => void }) {
  const { targets, target, skill, finished } = context;
  const selectable = !editing && !finished && targets.length > 0;
  return <div className="pt-rosters">{(['left', 'right'] as const).map(side => <section key={side} className={`pt-roster pt-roster-${side}`} aria-label={`${sideName(side)}全员概况`}>
    <h4>{sideName(side)} <small>存活 {battle.teams[side].filter(unit => unit.hp > 0).length} / {battle.teams[side].length}</small></h4>
    {battle.teams[side].map(unit => {
      const acting = !battle.winner && battle.side === side && battle.actorId === unit.id;
      const eligible = selectable && targets.some(item => item.id === unit.id);
      const selected = eligible && (skill?.target === 'all' || target?.id === unit.id);
      return <button type="button" key={unit.id} className={`pt-roster-unit${acting ? ' is-actor' : ''}${unit.hp <= 0 ? ' is-down' : ''}${eligible ? ' is-eligible' : ''}${selected ? ' is-target' : ''}`} disabled={!eligible} aria-label={`${sideName(side)}角色 ${unit.name}`} aria-pressed={selected} onClick={() => select(unit.id)}>
        <div className="pt-roster-heading"><b>{unit.name || '未命名'}</b><span>{selected ? '✓ 已选 · ' : ''}{unit.hp <= 0 ? '倒下' : acting ? `▶ 行动中${unit.guarding ? ' · 防御中' : ''}` : unit.guarding ? '防御中' : '待命'}</span></div>
        <div className="pt-roster-resource"><span>HP</span><progress aria-label={`${sideName(side)} ${unit.name}生命值`} max={unit.maxHp} value={unit.hp} /><b>{unit.hp} / {unit.maxHp}</b></div>
        <div className="pt-roster-resource is-mp"><span>MP</span><progress aria-label={`${sideName(side)} ${unit.name}魔力值`} max={Math.max(1, unit.maxMp)} value={unit.mp} /><b>{unit.mp} / {unit.maxMp}</b></div>
        <div className="pt-roster-stats">攻击 <b>{combatStats(unit).attack}</b><span>防御 <b>{combatStats(unit).defense}</b></span></div>
      </button>;
    })}
    {!battle.teams[side].length && <p className="pt-muted">暂无角色。</p>}
  </section>)}</div>;
}
