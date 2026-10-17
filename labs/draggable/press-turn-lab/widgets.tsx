import { useEffect, useId, useRef, type ReactNode } from 'react';
import { usePressStore } from './store.ts';
import { AFFINITIES, ELEMENTS, sideName, type Affinity, type Element, type ForcedRoll, type Side, type Skill, type Unit } from './types.ts';
import { playerContext } from './playerContext.ts';
import { PlayerActions } from './PlayerActions.tsx';
import { BasicPanel } from './BasicPanel.tsx';
import { BattlefieldRoster } from './BattlefieldRoster.tsx';
import { actionContext } from './actionContext.ts';


function Tabs({ label, items, active, select, add, remove, children, additions }: { label: string; items: { id: string; name: string }[]; active?: string; select: (id: string) => void; add: () => void; remove: () => void; children: ReactNode; additions?: ReactNode }) {
  const id = useId();
  return <div className="pt-tabs"><div className="pt-tabbar"><small>{label}</small><div role="tablist" aria-label={label}>{items.map((item, index) => <button type="button" role="tab" key={item.id} id={`${id}-${item.id}`} aria-selected={active === item.id} aria-controls={`${id}-panel`} tabIndex={active === item.id ? 0 : -1} onClick={() => select(item.id)} onKeyDown={event => {
    const next = event.key === 'ArrowRight' ? (index + 1) % items.length : event.key === 'ArrowLeft' ? (index + items.length - 1) % items.length : event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1 : -1;
    if (next < 0) return; event.preventDefault(); select(items[next].id); event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role=tab]')[next]?.focus();
  }}>{item.name || '未命名'}</button>)}</div>{additions ?? <button aria-label={`新建${label}`} onClick={add}>＋ 新建</button>}<button aria-label={`删除当前${label}`} disabled={!active} onClick={remove}>删除</button></div><div role="tabpanel" id={`${id}-panel`} aria-labelledby={active ? `${id}-${active}` : undefined}>{children}</div></div>;
}
function NumberField({ label, value, change, min = 0, max = 99999 }: { label: string; value: number; change: (n: number) => void; min?: number; max?: number }) {
  return <label>{label}<input type="number" min={min} max={max} value={value} onChange={event => { if (event.target.value === '') return; const n = Number(event.target.value); if (Number.isFinite(n)) change(Math.max(min, Math.min(max, Math.floor(n)))); }} /></label>;
}

function TeamPanel({ side, unitId }: { side: Side; unitId: string }) {
  const battle = usePressStore(state => state.battle);
  const state = usePressStore.getState();
  const unit = battle.teams[side].find(u => u.id === unitId);
  const skill = unit?.skills.find(s => s.id === unit.skillId);
  const update = (patch: Partial<Unit>) => { if (unit) state.patchUnit(side, unit.id, patch); };
  const updateSkill = (patch: Partial<Skill>) => { if (unit && skill) state.patchSkill(side, unit.id, skill.id, patch); };
  return unit ? <><div className={`pt-unit-summary ${battle.actorId === unit.id ? 'is-actor' : ''}`}><small>{sideName(side)} · {battle.actorId === unit.id ? '▶ 当前行动者' : unit.guarding ? '防御中' : unit.hp > 0 ? '存活' : '倒下'}</small><b>{unit.name}</b><strong>{unit.hp} / {unit.maxHp} HP <em>{unit.mp} / {unit.maxMp} MP</em></strong><progress aria-label={`${unit.name}生命值`} max={unit.maxHp} value={unit.hp} /></div>
    <label className="pt-name">名称<input value={unit.name} onChange={event => update({ name: event.target.value })} /><small title={unit.id}>{unit.id.slice(0, 10)}</small></label>
    <Tabs label={`${sideName(side)}技能`} items={unit.skills} active={skill?.id} select={id => update({ skillId: id })} add={() => state.addSkill(side, unit.id)} remove={() => { if (skill) state.removeSkill(side, unit.id, skill.id); }}>
      {skill ? <div className="pt-inset"><label className="pt-name">技能名称<input value={skill.name} onChange={event => updateSkill({ name: event.target.value })} /></label><div className="pt-fields">
        <label>技能类型<select value={skill.kind} onChange={event => updateSkill({ kind: event.target.value as Skill['kind'] })}><option value="attack">主动 · 伤害</option><option value="heal">主动 · 治疗己方</option><option value="passive">被动 · 常驻加成</option></select></label>
        {skill.kind === 'passive' && <><NumberField label="被动攻击加成" value={skill.passive?.attack ?? 0} change={attack => updateSkill({ passive: { attack, defense: skill.passive?.defense ?? 0 } })} /><NumberField label="被动防御加成" value={skill.passive?.defense ?? 0} change={defense => updateSkill({ passive: { attack: skill.passive?.attack ?? 0, defense } })} /></>}
        {skill.kind !== 'passive' && <><label>属性<select value={skill.element} onChange={event => updateSkill({ element: event.target.value as Element })}>{Object.entries(ELEMENTS).map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></label>
        <label>目标范围<select value={skill.target} onChange={event => updateSkill({ target: event.target.value as Skill['target'] })}><option value="single">单体</option><option value="all">全体</option></select></label>
        <NumberField label="威力" value={skill.power} change={power => updateSkill({ power })} />
        <NumberField label="MP 消耗" value={skill.mpCost} change={mpCost => updateSkill({ mpCost })} />
        <NumberField label="命中率 %" value={skill.accuracy} max={100} change={accuracy => updateSkill({ accuracy })} />
        <NumberField label="暴击率 %" value={skill.critical} max={100} change={critical => updateSkill({ critical })} /></>}
      </div></div> : <p className="pt-muted">点击“新建”添加技能。</p>}
    </Tabs><h4>单位参数</h4><div className="pt-fields">
      <NumberField label="生命值" value={unit.hp} max={unit.maxHp} change={hp => update({ hp })} /><NumberField label="生命上限" min={1} value={unit.maxHp} change={maxHp => update({ maxHp, hp: Math.min(unit.hp, maxHp) })} />
      <NumberField label="MP" value={unit.mp} max={unit.maxMp} change={mp => update({ mp })} /><NumberField label="MP 上限" value={unit.maxMp} change={maxMp => update({ maxMp, mp: Math.min(unit.mp, maxMp) })} />
      <NumberField label="攻击" value={unit.attack} change={attack => update({ attack })} /><NumberField label="防御" value={unit.defense} change={defense => update({ defense })} />
    </div><h4>属性相性</h4><div className="pt-affinities">{Object.entries(ELEMENTS).map(([key, label]) => <label key={key} data-affinity={unit.affinities[key as Element]}>{label}<select aria-label={`${label}相性`} disabled={key === 'almighty'} value={key === 'almighty' ? 'normal' : unit.affinities[key as Element]} onChange={event => update({ affinities: { ...unit.affinities, [key]: event.target.value as Affinity } })}>{Object.entries(AFFINITIES).map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></label>)}</div><p className="pt-muted">万能忽略相性。新增/删除队员后，点击“按当前配置重开”重新计算起始行动点。</p></> : <p className="pt-muted">暂无单位，点击“新建”添加。</p>;
}

export function FieldEditorPanel({ side, editing = false }: { side: Side; editing?: boolean }) {
  const battle = usePressStore(state => state.battle);
  const selectedId = usePressStore(state => state.selected[side]);
  const units = battle.teams[side];
  const unit = units.find(item => item.id === selectedId) ?? units[0];
  const state = usePressStore.getState();
  return <fieldset disabled={editing} className="pt-business"><Tabs label={`${sideName(side)}角色`} items={units} active={unit?.id} select={id => state.select(side, id)} add={() => state.addUnit(side)} remove={() => { if (unit) state.removeUnit(side, unit.id); }}>
    <p className="pt-muted">编辑{sideName(side)}角色数据；角色标签用于选择编辑对象，当前行动者由战斗顺序决定。</p>
    {unit ? <TeamPanel side={side} unitId={unit.id} /> : <p className="pt-muted">暂无角色，可添加{sideName(side)}单位。</p>}
  </Tabs></fieldset>;
}

export function TurnPanel() {
  const battle = usePressStore(state => state.battle);
  return <div className="pt-turn"><div className="pt-phase"><b>{battle.escapedBy ? `${sideName(battle.escapedBy)}已逃离 · 战斗结束` : battle.winner === 'draw' ? '双方全部倒下' : battle.winner ? `${sideName(battle.winner)}胜利` : `${sideName(battle.side)}行动阶段`}</b><span>回合 {battle.round} / 阶段 {battle.phase}</span></div><div className="pt-icons" aria-label={`行动点 ${battle.icons.full} 大点 ${battle.icons.half} 半点`}>
    {Array.from({ length: battle.icons.full }, (_, i) => <i key={`f${i}`} title="大行动点">◆</i>)}{Array.from({ length: battle.icons.half }, (_, i) => <i className="half" key={`h${i}`} title="半行动点">◐</i>)}{battle.icons.full + battle.icons.half === 0 && <small>行动点耗尽</small>}
  </div><div className="pt-meter"><b>大点 {battle.icons.full}</b><b>半点 {battle.icons.half}</b><span>行动者：{battle.teams[battle.side].find(u => u.id === battle.actorId)?.name ?? '—'}</span></div>
  </div>;
}
export function CommandPanel({ editing = false }: { editing?: boolean }) {
  const battle = usePressStore(state => state.battle); const state = usePressStore.getState();
  const forced = usePressStore(state => state.forced);
  const { actor, finished } = playerContext(battle);
  return <fieldset disabled={editing} className="pt-business"><div className="pt-command-fields">
    <label>行动者（调试切换）<select value={actor?.id ?? ''} onChange={event => state.setActor(event.target.value)}><option value="" disabled>请选择存活单位</option>{battle.teams[battle.side].filter(u => u.hp > 0).map(u => <option key={u.id} value={u.id}>{u.name}</option>)}</select></label>
    <label>掷判模式<select value={forced} onChange={event => state.setForced(event.target.value as ForcedRoll)}><option value="random">按命中率 / 暴击率</option><option value="hit">必定命中，不暴击</option><option value="critical">强制暴击</option><option value="miss">强制未命中</option></select></label>
  </div><div className="pt-buttons"><button disabled={finished} onClick={state.end}>结束本方阶段</button></div><p className="pt-muted">行动和选项在“操控面板”选择。掷判设置同时作用于手动和自动一步。</p></fieldset>;
}

export function BattlefieldPanel({ editing = false }: { editing?: boolean }) {
  const battle = usePressStore(state => state.battle);
  return <fieldset className="pt-business pt-battlefield" disabled={editing}>
    <TurnPanel />
    <BattlefieldRoster battle={battle} context={actionContext(battle)} editing={true} select={() => {}} />
  </fieldset>;
}
export function PlayerPanel({ editing = false }: { editing?: boolean }) {
  const battle = usePressStore(state => state.battle);
  return <fieldset className="pt-business pt-player" disabled={editing}>
    <BasicPanel title="当前行动者" unit={playerContext(battle).actor} />
    <PlayerActions key={`${battle.side}-${battle.actorId}-${battle.phase}-${battle.round}-${battle.logs.length}`} editing={editing} />
  </fieldset>;
}
export function RulesPanel() {
  return <><table className="pt-table"><thead><tr><th>结果</th><th>行动点处理</th></tr></thead><tbody><tr><td>普通 / 耐性 / 治疗 / 防御 / 整备 / 对话 / 观察</td><td>优先消耗半点，否则消耗大点</td></tr><tr><td>弱点 / 暴击 / 换手 / 空过</td><td>大点变半点；无大点时消耗半点</td></tr><tr><td>未命中</td><td>消耗两个图标，半点优先</td></tr><tr><td>无效 / 反射 / 吸收</td><td>清空剩余行动点并换手</td></tr></tbody></table><p className="pt-muted">全体攻击只结算一次行动点：无效类 ＞ 未命中 ＞ 弱点/暴击 ＞ 普通。弱点与暴击不重复奖励。伤害 = max(1, 威力 + 攻击 − 防御) × 相性 × 暴击 × 防御姿态，向下取整且至少为 1。弱点/暴击 ×1.5，耐性/防御姿态 ×0.5。</p></>;
}
export function BattleLog() {
  const logs = usePressStore(state => state.battle.logs); const last = usePressStore(state => state.battle.last); const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { if (ref.current) ref.current.scrollTop = ref.current.scrollHeight; }, [logs.length]);
  return <div className="pt-log-panel">{last && <div className="pt-last"><b>上次行动点：{last.before.full}大/{last.before.half}半 → {last.after.full}大/{last.after.half}半</b></div>}<div className="pt-log" role="log" ref={ref}>{logs.map((line, i) => <div key={i}><small>{String(i + 1).padStart(3, '0')}</small>{line}</div>)}{!logs.length && <p>等待行动。</p>}</div></div>;
}
export function RuntimePanel() { const battle = usePressStore(state => state.battle); return <pre className="pt-json">{JSON.stringify(battle, null, 2)}</pre>; }
export function SessionButtons({ editing = false }: { editing?: boolean }) {
  const state = usePressStore.getState();
  return <fieldset className="pt-business pt-buttons" disabled={editing}><button onClick={state.restart}>按当前配置重开</button><button onClick={state.reset}>恢复示例</button><button onClick={state.clear}>清空日志</button></fieldset>;
}
