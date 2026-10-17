import { useRef, useState } from 'react';
import { usePressStore } from './store.ts';
import { ACTION_HINTS, ACTION_NAMES, actionContext, type PlayerAction } from './actionContext.ts';
import { ELEMENTS, sideName } from './types.ts';
import { BasicPanel } from './BasicPanel.tsx';
import { PreparationOptions } from './PreparationOptions.tsx';
import { currentPreparation, type Preparation } from './preparation.ts';

export function PlayerActions({ editing = false }: { editing?: boolean }) {
  const battle = usePressStore(state => state.battle);
  const forced = usePressStore(state => state.forced);
  const targetId = usePressStore(state => state.targetId);
  const [kind, setKind] = useState<PlayerAction>();
  const [teammateId, setTeammateId] = useState<string>();
  const [skillId, setSkillId] = useState<string>();
  const [preparation, setPreparation] = useState<Preparation>();
  const [message, setMessage] = useState('我们可以谈谈吗？');
  const submitting = useRef(false);
  const context = actionContext(battle, kind, skillId, kind === 'swap' ? teammateId : targetId);
  const { actor, skill, skills, targets, target, targetSide, finished, canConfirm } = context;
  const state = usePressStore.getState();
  const cancel = () => setKind(undefined);
  const choose = (next: PlayerAction) => {
    if (editing || finished || !actor) return;
    setKind(next);
    if (next === 'prepare') setPreparation(currentPreparation(actor));
    setSkillId(actor.skillId); setTeammateId(undefined);
  };
  const confirm = () => {
    if (editing || !kind || !actor || !canConfirm || submitting.current) return;
    submitting.current = true;
    state.act({ kind, actorId: actor.id, skillId: skill?.id, targetId: target?.id, forced, preparation, message });
    setKind(undefined);
  };
  const summary = kind ? `${ACTION_NAMES[kind]}${kind === 'skill' && skill ? ` · ${skill.name}` : ''}${kind === 'swap' ? ` → ${target?.name ?? '无可用队友'}` : kind === 'talk' || kind === 'observe' ? ` → ${target?.name ?? '无有效目标'}` : skill ? ` → ${skill.target === 'all' ? `${sideName(targetSide)}全体（${targets.length}人）` : target?.name ?? '无有效目标'}` : ''}` : '请选择本次行动。';
  return <>
    <div className="pt-control-side"><b>当前操控：{sideName(battle.side)} · {actor?.name ?? '无行动者'}</b><button disabled={editing || finished || !actor} onClick={state.autoStep}>自动选择并执行一次行动</button></div>
    <h4>执行行动</h4><div className="pt-choice-list pt-action-choices" aria-label="选择行动">{(Object.keys(ACTION_NAMES) as PlayerAction[]).map(id => <button type="button" key={id} aria-pressed={kind === id} disabled={editing || finished || !actor} onClick={() => choose(id)}><b>{ACTION_NAMES[id]}</b><small>{ACTION_HINTS[id]}</small></button>)}</div>
    {!editing && (kind === 'attack' || kind === 'skill' || kind === 'swap' || kind === 'talk' || kind === 'observe') && <section className="pt-action-options" aria-label={`${ACTION_NAMES[kind]}选项`}>
      {kind === 'skill' && <><h4>选择技能</h4><div className="pt-choice-list" aria-label="选择技能">{skills.map(item => <button key={item.id} aria-pressed={item.id === skill?.id} onClick={() => { setSkillId(item.id); if (actor) state.patchUnit(battle.side, actor.id, { skillId: item.id }); }}><b>{item.name}</b><small>{item.kind === 'heal' ? '治疗' : ELEMENTS[item.element]} · {item.target === 'all' ? '全体' : '单体'} · {item.mpCost} MP</small></button>)}</div>{!skills.length && <p className="pt-muted">暂无技能，请在角色数据中添加。普通攻击始终可以从行动列表选择。</p>}</>}
      {(kind !== 'skill' || skill) && <><h4>{kind === 'swap' ? '选择接手队友' : `选择${sideName(targetSide)}目标`}</h4><div className="pt-choice-list" aria-label="行动目标">{targets.map(unit => <button key={unit.id} aria-pressed={skill?.target === 'all' || unit.id === target?.id} onClick={() => kind === 'swap' ? setTeammateId(unit.id) : state.setTarget(unit.id)}><b>{unit.name}</b><small>HP {unit.hp}/{unit.maxHp}</small></button>)}</div>{!targets.length && <p className="pt-muted">没有可用的存活目标。</p>}</>}
      {kind === 'talk' && <label className="pt-name">对话内容<input maxLength={160} value={message} onChange={event => setMessage(event.target.value)} /></label>}
      {skill && <p className="pt-player-skill">{skill.name} · 威力 {skill.power} · 消耗 {skill.mpCost} MP{actor && actor.mp < skill.mpCost && <strong> · MP 不足</strong>}</p>}
      {target && skill?.target !== 'all' && <BasicPanel title={kind === 'swap' ? '换手队友' : '选中目标'} unit={target} />}
    </section>}
    {kind === 'prepare' && actor && preparation && <PreparationOptions actor={actor} draft={preparation} change={setPreparation} />}
    {kind === 'escape' && <p className="pt-action-summary">确认后撤离并结束当前战斗。本版为必定成功，重开后可继续测试。</p>}
    <p className="pt-action-summary" role="status">{summary}</p>
    <div className="pt-buttons"><button className="pt-primary" disabled={editing || !canConfirm} onClick={confirm}>确认行动</button>{kind && <button onClick={cancel}>取消选择</button>}</div>
    <p className="pt-muted">选择行动后在下方设置选项，再统一确认。换手与空过：大点变半点；无大点时消耗一个半点。</p>
    {battle.report && <section className="pt-action-report" aria-label="行动结果"><h4>{battle.report.title}</h4><p>{battle.report.text}</p></section>}
  </>;
}
